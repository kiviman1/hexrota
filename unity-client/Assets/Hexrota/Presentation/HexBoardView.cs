using System;
using System.Collections;
using System.Collections.Generic;
using Hexrota.Gameplay;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // This component owns disposable visual state only. Receipts come from the
    // committed application session; no matching, adjacency, scoring or RNG here.
    public sealed partial class HexBoardView : MonoBehaviour, IPointerDownHandler, IPointerUpHandler,
        IDragHandler, ICancelHandler
    {
        public event Action<int, int> SwapRequested;
        public event Action PresentationCompleted;
        public event Action PresentationCancelled;
        public event Action<MovePresentation> PresentationStarted;
        public event Action<WaveFrame,int,float> WaveProgress;
        public Camera BoardCamera { get; private set; }
        public bool IsAnimating { get; private set; }
        public bool InputEnabled { get; set; }
        public bool ReducedMotion { get; set; }
        public bool CanPresent { get { return this != null && isActiveAndEnabled && HasVisuals; } }
        private HexrotaAssetCatalog assets;
        private Transform world;
        private Transform effectRoot;
        private readonly List<GameObject> cells = new List<GameObject>();
        private readonly List<GameObject> grounds = new List<GameObject>();
        private readonly List<GameObject> stones = new List<GameObject>();
        private readonly List<TextMesh> numbers = new List<TextMesh>();
        private Vector3[] positions;
        private int[] initialLayers;
        private Color[] floorEdges;
        private bool tutorialLayout, hasMutedTiles, frameNineByNine;
        private Bounds frameBounds;
        private Vector3 restingCamera;

        private int pressed = -1, pointer = int.MinValue;
        private Vector2 down;
        private bool dragged;
        private Coroutine animation;
        private GameSnapshot settledSnapshot;
        private MaterialPropertyBlock tint;
        private Material digitsMaterial;
        private Font digitsFont;
        private bool authoredFloor;
        private Material stoneMaterial;
        private Sprite[] stoneSprites;
        private Vector2[] digitCentres;
        /// <summary>Numeral height as a share of the stone's painted height.</summary>
        public const float DigitHeightShare = .5f;
        /// <summary>The dark outline around each white numeral, as a share of the numeral height.</summary>
        public const float DigitOutlineShare = .085f;
        public static readonly Color DigitFace = Color.white;
        public static readonly Color DigitOutline = new Color32(43, 24, 18, 255);
        private void Awake()
        {
            tint = new MaterialPropertyBlock();
            Font.textureRebuilt += RefreshDigitAtlas;
        }

        private void RefreshDigitAtlas(Font changed)
        {
            if (this != null && digitsMaterial != null && changed == digitsFont)
                digitsMaterial.mainTexture = changed.material.mainTexture;
        }

        // The detached visual root can be destroyed before the canvas/controller
        // during scene unload. Unity's destroyed-object check must precede any
        // access to cached transforms, including on the frame after a yield.
        private bool HasVisuals
        {
            get
            {
                if (this == null || world == null || effectRoot == null || positions == null ||
                    stones.Count != positions.Length || grounds.Count != stones.Count ||
                    cells.Count != stones.Count || numbers.Count != stones.Count) return false;
                for (int i = 0; i < stones.Count; i++)
                    if (stones[i] == null || grounds[i] == null || cells[i] == null || numbers[i] == null) return false;
                return true;
            }
        }

        public void Initialize(Camera camera, HexrotaAssetCatalog catalog)
        {
            BoardCamera = camera; assets = catalog;
            // One font for every numeral; the stones are 2D sprites imported from art/stones/source.
            digitsFont = assets != null && assets.stoneDigitFont != null
                ? assets.stoneDigitFont : Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            stoneSprites = assets != null ? assets.stoneSprites : null;
            digitCentres = assets != null ? assets.stoneDigitCentres : null;
            authoredFloor = assets != null && assets.ground != null && assets.ground.GetComponent<CastleBoardTile>() != null;
            world = new GameObject("BoardVisuals_PLACEHOLDER").transform;
            world.SetParent(transform, false);
            // Canvas children cannot own world-space model transforms. Keep the
            // visual root outside the canvas and explicitly dispose it on destroy.
            world.SetParent(null, false);
            effectRoot = new GameObject("Effects").transform;
            effectRoot.SetParent(world, false);
        }

        public void Build(LevelConfig level, GameSnapshot snapshot, bool frameNineByNine = false)
        {
            if (this == null || world == null || effectRoot == null) return;
            Cancel(null); ClearModels(); positions = new Vector3[level.cells.Length];
            initialLayers = new int[level.cells.Length]; floorEdges = new Color[level.cells.Length];
            tutorialLayout = level.id is string;
            this.frameNineByNine = frameNineByNine;
            for (int i = 0; i < level.cells.Length; i++)
            {
                initialLayers[i] = level.cells[i].layers;
                Vector2 xy = MobileLayout.Axial(level.cells[i].q, level.cells[i].r);
                positions[i] = new Vector3(xy.x, xy.y, 0);
                var cell = Make(assets == null ? null : assets.cell, "Cell_" + i, world);
                cell.transform.position = positions[i] + Vector3.forward * .12f;
                cells.Add(cell);
                var ground = Make(assets == null ? null : assets.ground, "Ground_" + i, world);
                ground.transform.position = positions[i]; grounds.Add(ground);
                var stone = new GameObject("Stone_" + i);
                stone.transform.SetParent(world, false);
                stone.transform.position = positions[i] + Vector3.back * .15f; stones.Add(stone);
                numbers.Add(BuildStone(stone.transform, i));
            }
            frameBounds = CellFrame();
            PrepareMotion(level);
            PrepareTerrain(level.obstacles);
            Render(snapshot); FitCamera();
        }

        // A stone is its painted sprite ("Model") and a numeral ("Value_i"): white face text over
        // dark copies offset around it, drawn after every stone sprite.
        private TextMesh BuildStone(Transform stone, int index)
        {
            if (stoneMaterial == null)
                stoneMaterial = new Material(Resources.Load<Shader>("PhoneArt/BoardStone")) { name = "Board stone" };
            var model = new GameObject("Model");
            model.transform.SetParent(stone, false);
            var art = model.AddComponent<SpriteRenderer>();
            art.sharedMaterial = stoneMaterial;
            art.sortingOrder = 0;
            return BuildNumeral(stone, "Value_" + index, 1f);
        }

        // White face text over twelve dark copies offset around it; scale 1 is half a stone's height.
        private TextMesh BuildNumeral(Transform parent, string name, float scale)
        {
            if (digitsMaterial == null)
            {
                digitsFont.RequestCharactersInTexture("0123456789", DigitFontSize, FontStyle.Normal);
                digitsMaterial = new Material(Resources.Load<Shader>("PhoneArt/BoardDigit")) {
                    name = "Board number ink", mainTexture = digitsFont.material.mainTexture
                };
            }
            var face = Digit(parent, name, DigitFace, 2);
            float size = DigitCharacterSize() * scale;
            face.characterSize = size;
            float ring = DigitOutlineShare * DigitHeightShare * StoneHeight() * scale;
            for (int k = 0; k < 12; k++)
            {
                float angle = k * Mathf.PI / 6f;
                var outline = Digit(face.transform, "Outline", DigitOutline, 1);
                outline.characterSize = size;
                outline.transform.localPosition = new Vector3(Mathf.Cos(angle) * ring, Mathf.Sin(angle) * ring, .002f);
            }
            return face;
        }

        private const int DigitFontSize = 96;

        private TextMesh Digit(Transform parent, string name, Color color, int order)
        {
            var node = new GameObject(name);
            node.transform.SetParent(parent, false);
            node.transform.localPosition = new Vector3(0, 0, -.02f);
            var text = node.AddComponent<TextMesh>();
            text.anchor = TextAnchor.MiddleCenter; text.alignment = TextAlignment.Center;
            text.font = digitsFont; text.fontSize = DigitFontSize; text.fontStyle = FontStyle.Normal;
            text.color = color; text.text = "0";
            var renderer = node.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = digitsMaterial;
            renderer.sortingOrder = order;
            return text;
        }

        /// <summary>Average world height of the painted stones (they share one visual size).</summary>
        private float StoneHeight()
        {
            float sum = 0; int count = 0;
            if (assets != null && assets.stonePaintedHeights != null)
                foreach (float height in assets.stonePaintedHeights)
                    if (height > 0) { sum += height; count++; }
            return count > 0 ? sum / count : .72f;
        }

        // Character size that makes a digit's ink about half the stone's painted height.
        private float DigitCharacterSize()
        {
            CharacterInfo glyph;
            float ink = digitsFont.GetCharacterInfo('5', out glyph, DigitFontSize, FontStyle.Normal) && glyph.glyphHeight > 0
                ? glyph.glyphHeight : DigitFontSize * .72f;
            // TextMesh draws font pixels at characterSize / 10 world units each.
            return DigitHeightShare * StoneHeight() / (ink * .1f);
        }

        public void SetViewport(Rect safe)
        {
            SetCameraArea(MobileLayout.BoardViewport(safe));
        }

        public void SetCameraArea(Rect area)
        {
            if (BoardCamera == null) return;
            StopIdleHint();
            if (pointer != int.MinValue && BoardCamera.rect != area) OnCancel(null);
            BoardCamera.rect = area; FitCamera();
        }

        public Vector2 ViewportCell(int index)
        {
            return BoardCamera != null && positions != null && index >= 0 && index < positions.Length
                ? (Vector2)BoardCamera.WorldToViewportPoint(positions[index]) : Vector2.zero;
        }

        private Bounds CellFrame()
        {
            var bounds = new Bounds(positions[0], Vector3.zero);
            if (frameNineByNine)
            {
                // The Git-authored 9×9 frame is odd-q. The odd column's lower
                // half-row belongs to the frame even when all four corners are void.
                for (int q = -4; q <= 4; q++)
                {
                    int offset = Mathf.FloorToInt(q * .5f);
                    bounds.Encapsulate(MobileLayout.Axial(q, -4 - offset));
                    bounds.Encapsulate(MobileLayout.Axial(q, 4 - offset));
                }
            }
            foreach (Vector3 position in positions) bounds.Encapsulate(position);
            return bounds;
        }

        internal Vector2 FrameVerticalLimits()
        {
            return new Vector2(BoardCamera.WorldToViewportPoint(frameBounds.min).y,
                BoardCamera.WorldToViewportPoint(frameBounds.max).y);
        }

        private void FitCamera()
        {
            if (BoardCamera == null || positions == null || positions.Length == 0) return;
            float aspect = Mathf.Max(.1f, BoardCamera.pixelRect.width / Mathf.Max(1, BoardCamera.pixelRect.height));
            const float unit = .56f / 44;
            float width = Mathf.Max((tutorialLayout ? 275 : 370)*unit, frameBounds.size.x + (frameNineByNine ? 92 : 104)*unit);
            float height = Mathf.Max((tutorialLayout ? 260 : 300)*unit, frameBounds.size.y + (40*Mathf.Sqrt(3)+(frameNineByNine ? 12 : 26))*unit);
            BoardCamera.orthographicSize = .5f * Mathf.Max(height, width/aspect);
            restingCamera = new Vector3(frameBounds.center.x, frameBounds.center.y, -20);
            BoardCamera.transform.rotation = Quaternion.identity;
            SetEntranceSlide(entranceSlide);
        }

        public void Render(GameSnapshot snapshot)
        {
            if (snapshot == null) return;
            if (!HasVisuals || stones.Count != snapshot.values.Length) return;
            settledSnapshot = snapshot;
            StopIdleHint(); idleClock.Bind(idleAttempt,VisibleKey(snapshot));
            if (hasMutedTiles) MarkPair(null);
            for (int i = 0; i < stones.Count; i++)
            {
                stones[i].transform.position = positions[i] + Vector3.back * .15f;
                DeformStone(stones[i], Vector2.right);
                SetMotionInk(stones[i], 1f, 0f);
                PaintStone(i, snapshot.values[i]);
                PaintFloor(i, snapshot.layers[i]);
            }
            PaintTerrain(snapshot.blockerHp, snapshot.cellOpen, snapshot.regionOpen);
            ClearEffects();
        }

        // Authored tutorial and hint pairs are presentation only. Commands still
        // validate the pointed cells against the session's current attempt.
        public void MarkPair(int[] pair, int[] matchIndices = null)
        {
            if (!HasVisuals) return;
            bool guide = pair != null && matchIndices != null;
            for (int i = 0; i < cells.Count; i++)
            {
                bool focus = pair != null && Array.IndexOf(pair, i) >= 0;
                bool support = guide && Array.IndexOf(matchIndices, i) >= 0;
                Tint(cells[i], focus || support ? (Color)new Color32(244,255,184,255) : floorEdges[i]);
                if (cells[i].GetComponent<PlaceholderHexMesh>() != null)
                    cells[i].transform.localScale = new Vector3(focus ? .973f : .926f,focus ? .973f : .926f,1);
                stones[i].transform.position = positions[i] + Vector3.back * .15f;
                DeformStone(stones[i], Vector2.right, uniform: focus ? 1.025f : 1f);
                if (guide || hasMutedTiles)
                {
                    float opacity = guide && !focus && !support ? .30f : 1f;
                    SetGuideOpacity(cells[i], opacity, authoredFloor ? .433f/1.055f : .485f*.875f/.926f);
                    float coveredFloor = authoredFloor ? .433f*.78f : .485f*.727f/.875f;
                    SetGuideOpacity(grounds[i], opacity, stones[i].activeSelf ? coveredFloor : 0);
                    SetGuideOpacity(stones[i], opacity);
                    if (numbers[i] != null)
                        foreach (var label in numbers[i].GetComponentsInChildren<TextMesh>(true))
                        {
                            Color ink = label.color;
                            ink.a = opacity;
                            label.color = ink;
                        }
                }
            }
            hasMutedTiles = guide;
        }

        internal bool CanShowTutorialGesture => InputEnabled && !IsAnimating && pointer == int.MinValue &&
            targetCell == null && CanPresent;

        private void MoveAlongSwap(int a, int b, float t, float strain, float handoff)
        {
            Vector3 delta = positions[b] - positions[a];
            float arc = 4f * t * (1f - t);
            Vector3 offset = delta * t + new Vector3(delta.y, -delta.x, 0f) * (.14f * arc);
            Vector3 depth = Vector3.forward * StoneDepth;
            stones[a].transform.position = positions[a] + offset + depth + Vector3.back * (.40f * arc);
            stones[b].transform.position = positions[b] - offset + depth + Vector3.back * (.08f * arc);
            DeformStone(stones[a], delta, strain + handoff);
            DeformStone(stones[b], delta, strain);
        }

        private void SetGuideOpacity(GameObject tile, float opacity, float cutout = 0)
        {
            foreach (var renderer in tile.GetComponentsInChildren<Renderer>())
            {
                renderer.GetPropertyBlock(tint);
                tint.SetFloat("_GuideOpacity", opacity);
                tint.SetFloat("_GuideCutout",opacity < 1 ? cutout : 0);
                renderer.SetPropertyBlock(tint);
            }
        }

        public void Present(MovePresentation receipt)
        {
            Cancel(receipt.Before);
            if (!CanPresent) return;
            PresentationStarted?.Invoke(receipt);
            if (ReducedMotion)
            {
                Render(receipt.After);
                PresentationCompleted?.Invoke();
                return;
            }
            IsAnimating = true;
            settledSnapshot = receipt.After;
            animation = StartCoroutine(Animate(receipt, swipeStretch));
        }

        private Action<int> targetCell;
        private int[] lessonPair;

        internal void SetOpeningPair(int[] pair)
        {
            lessonPair = pair;
            if (pair != null) StopIdleHint();
            else if (hasMutedTiles) MarkPair(null);
        }

        internal bool AcceptsOpeningSwap(int from, int to)
        {
            return lessonPair == null || (from == lessonPair[0] && to == lessonPair[1]) ||
                   (from == lessonPair[1] && to == lessonPair[0]);
        }

        public void SelectCellForItem(Action<int> onTap)
        {
            StopIdleHint();
            targetCell = onTap;
        }

        public void Cancel(GameSnapshot authoritative)
        {
            EndEntrance();
            StopIdleHint();
            ResetGesture();
            targetCell = null;
            bool wasAnimating = IsAnimating;
            if (this != null && animation != null) StopCoroutine(animation);
            animation = null; IsAnimating = false;
            ClearEffects(); Render(authoritative ?? settledSnapshot);
            if (wasAnimating && PresentationCancelled != null) PresentationCancelled();
        }

        public void OnPointerDown(PointerEventData e)
        {
            StopIdleHint();
            if (e.button != PointerEventData.InputButton.Left) return;
            if (pointer != int.MinValue)
            {
                if (pointer != e.pointerId) OnCancel(null);
                return;
            }
            if (this == null || !isActiveAndEnabled || !HasVisuals || !InputEnabled || IsAnimating || Input.touchCount > 1) return;
            int start = Hit(e.position);
            if (start < 0 || (closedCells != null && closedCells[start]) ||
                (targetCell == null && !stones[start].activeSelf)) return;
            if (lessonPair != null && start != lessonPair[0] && start != lessonPair[1]) return;
            pointer = e.pointerId;
            down = e.position;
            pressed = start;
            pressedViewport = BoardCamera.pixelRect;
            float dpi = Screen.dpi;
            swipePixelScale = UnityEngine.Application.isMobilePlatform && !UnityEngine.Application.isEditor && dpi > 0f ? dpi / 160f : 1f;
        }
        public void OnDrag(PointerEventData e)
        {
            if (e.pointerId == pointer) SampleSwipe(e.position);
        }
        public void OnPointerUp(PointerEventData e)
        {
            if (e.pointerId != pointer) return;
            SampleSwipe(e.position);
            if (e.pointerId != pointer) return;
            int from = pressed;
            bool wasDrag = dragged;
            int to = wasDrag ? -1 : Hit(e.position);
            ResetGesture();
            if (targetCell != null)
            {
                if (!wasDrag && from == to)
                {
                    var onTap = targetCell; targetCell = null;
                    onTap(to);
                }
                return;
            }
            // Normal play is swipe only: a tap never selects a stone. Short swipes below the threshold end here too.
        }
        public void OnCancel(BaseEventData data)
        {
            ResetGesture();
        }
        private void Request(int from, int to)
        {
            if (SwapRequested != null) SwapRequested(from, to);
        }
        private int Hit(Vector2 screen)
        {
            if (BoardCamera == null || !HasVisuals || !BoardCamera.pixelRect.Contains(screen)) return -1;
            var ray = BoardCamera.ScreenPointToRay(screen);
            var plane = new Plane(Vector3.forward, Vector3.zero); float distance;
            if (!plane.Raycast(ray, out distance)) return -1;
            Vector3 point = ray.GetPoint(distance); float nearest = .56f * .56f; int result = -1;
            for (int i = 0; i < positions.Length; i++)
            {
                float d = (positions[i] - point).sqrMagnitude;
                if (d < nearest) { result = i; nearest = d; }
            }
            return result;
        }
        private void PaintStone(int i, int? value)
        {
            stones[i].SetActive(value.HasValue);
            if (!value.HasValue) return;
            int slot = value.Value - 1;
            var art = stones[i].transform.Find("Model");
            var sprite = stoneSprites != null && slot >= 0 && slot < stoneSprites.Length ? stoneSprites[slot] : null;
            if (art != null)
            {
                var renderer = art.GetComponent<SpriteRenderer>();
                renderer.sprite = sprite;
                renderer.color = Color.white;
            }
            Tint(stones[i], Color.white);
            var number = numbers[i];
            if (number == null) return;
            string text = value.Value.ToString();
            foreach (var label in number.GetComponentsInChildren<TextMesh>(true)) label.text = text;
            Vector2 centre = digitCentres != null && slot >= 0 && slot < digitCentres.Length ? digitCentres[slot] : Vector2.zero;
            number.transform.localPosition = new Vector3(centre.x, centre.y, -.02f);
        }

        private void PaintFloor(int index, int layers)
        {
            bool green = layers == 0, partial = !green && layers < initialLayers[index];
            float mark = green ? 3 : initialLayers[index] == 2 ? layers : 0;
            var tile = grounds[index].GetComponent<CastleBoardTile>();
            if (tile != null && tile.Show(green ? 2 : partial ? 1 : 0))
            {
                floorEdges[index] = Color.white;
                Tint(cells[index], floorEdges[index]);
                Tint(grounds[index], Color.white, mark:mark);
                return;
            }
            Color fill = green ? new Color32(118,217,67,255) : partial ? new Color32(134,119,72,255) : new Color32(83,75,60,255);
            floorEdges[index] = green ? new Color32(183,250,126,255) : partial ? new Color32(223,196,127,255) : new Color32(141,123,90,255);
            Tint(cells[index], floorEdges[index]); Tint(grounds[index],fill,mark:mark);
        }
        private void Tint(GameObject obj, Color color, Color rim = default(Color), float width = 0, float mark = 0)
        {
            if (obj == null || tint == null) return;
            foreach (Renderer renderer in obj.GetComponentsInChildren<Renderer>())
            {
                if (renderer is MeshRenderer && renderer.GetComponent<TextMesh>() != null) continue;
                renderer.GetPropertyBlock(tint); tint.SetColor("_Color", color); tint.SetColor("_BaseColor", color);
                tint.SetColor("_RimColor",rim); tint.SetFloat("_RimWidth",width);
                tint.SetFloat("_FloorMark",mark);
                renderer.SetPropertyBlock(tint);
            }
        }
        private GameObject Make(GameObject prefab, string name, Transform parent)
        {
            return HexrotaAssetCatalog.InstantiateOrFallback(prefab, parent, name);
        }
        private void ClearEffects()
        {
            if (effectRoot == null) return;
            foreach (Transform child in effectRoot) Destroy(child.gameObject);
        }
        private void ClearModels()
        {
            foreach (var o in cells) if (o != null) { o.SetActive(false); Destroy(o); }
            foreach (var o in grounds) if (o != null) { o.SetActive(false); Destroy(o); }
            foreach (var o in stones) if (o != null) { o.SetActive(false); Destroy(o); }
            cells.Clear(); grounds.Clear(); stones.Clear(); numbers.Clear(); motionInk.Clear();
            settledSnapshot = null;
        }
        private void OnDisable() { InputEnabled = false; Cancel(null); }
        private void OnDestroy()
        {
            Cancel(null);
            SwapRequested = null; PresentationCompleted = null; PresentationCancelled = null;
            PresentationStarted = null; WaveProgress = null;
            cells.Clear(); grounds.Clear(); stones.Clear(); numbers.Clear(); positions = null;
            Font.textureRebuilt -= RefreshDigitAtlas;
            if (digitsMaterial != null) Destroy(digitsMaterial);
            if (stoneMaterial != null) Destroy(stoneMaterial);
            if (world != null) Destroy(world.gameObject);
            world = null; effectRoot = null; BoardCamera = null; tint = null;
        }
    }
}
