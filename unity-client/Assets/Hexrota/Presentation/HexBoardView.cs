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
        public int SelectedIndex { get { return selected; } }
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

        private int selected = -1, pressed = -1, pointer = int.MinValue;
        private Vector2 down;
        private bool dragged;
        private GameObject selection;
        private Coroutine animation;
        private MaterialPropertyBlock tint;
        private Material digitsMaterial;
        private Font digitsFont;
        private bool authoredStone, authoredFloor, numberInMesh;
        private static readonly Color[] Colors = {
            new Color32(235,227,245,255), new Color32(179,101,242,255),
            new Color32(255,207,40,255), new Color32(255,104,81,255),
            new Color32(39,159,237,255), new Color32(241,92,189,255)
        };
        private static readonly Color32[] Edges = {
            new Color32(255,255,255,255), new Color32(215,163,255,255), new Color32(255,233,149,255),
            new Color32(255,179,154,255), new Color32(143,221,255,255), new Color32(255,176,223,255)
        };
        private static readonly Color32[] Inks = {
            new Color32(43,34,53,255), new Color32(44,14,67,255), new Color32(88,51,0,255),
            new Color32(85,27,16,255), new Color32(9,47,83,255), new Color32(74,19,61,255)
        };

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
                    if (stones[i] == null || grounds[i] == null || cells[i] == null || (!numberInMesh && numbers[i] == null)) return false;
                return true;
            }
        }

        public void Initialize(Camera camera, HexrotaAssetCatalog catalog)
        {
            BoardCamera = camera; assets = catalog;
            var numberTemplate = assets != null && assets.stone != null ? assets.stone.GetComponentInChildren<TextMesh>(true) : null;
            digitsFont = numberTemplate != null && numberTemplate.font != null
                ? numberTemplate.font : Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var wrapper = assets != null && assets.stone != null ? assets.stone.GetComponent<CastleBoardTile>() : null;
            authoredStone = wrapper != null;
            numberInMesh = authoredStone && wrapper.NumberInMesh;
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
                GameObject stone;
                if (authoredStone) stone = Make(assets.stone, "Stone_" + i, world);
                else
                {
                    stone = new GameObject("Stone_" + i);
                    stone.transform.SetParent(world, false);
                    Make(assets == null ? null : assets.stone, "Artwork", stone.transform);
                }
                stone.transform.position = positions[i] + Vector3.back * .15f; stones.Add(stone);
                if (numberInMesh)
                {
                    numbers.Add(null);
                    continue;
                }
                var text = stone.GetComponentInChildren<TextMesh>(true);
                if (text == null)
                {
                    var fallback = new GameObject();
                    fallback.transform.SetParent(stone.transform, false);
                    fallback.transform.localPosition = new Vector3(0,0,-.38f);
                    text = fallback.AddComponent<TextMesh>();
                    text.anchor = TextAnchor.MiddleCenter; text.alignment = TextAlignment.Center;
                    text.font = digitsFont; text.fontSize = 64; text.fontStyle = FontStyle.Bold; text.characterSize = .068f;
                }
                text.gameObject.name = "Value_" + i;
                if (digitsMaterial == null)
                {
                    digitsFont.RequestCharactersInTexture("0123456789", text.fontSize, text.fontStyle);
                    digitsMaterial = new Material(Resources.Load<Shader>("PhoneArt/BoardDigit")) {
                        name = "Board number ink", mainTexture = digitsFont.material.mainTexture
                    };
                }
                text.GetComponent<MeshRenderer>().sharedMaterial = digitsMaterial;
                numbers.Add(text);
            }
            frameBounds = CellFrame();
            PrepareMotion(level);
            PrepareTerrain(level.obstacles);
            Render(snapshot); FitCamera();
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
            StopIdleHint(); idleClock.Bind(idleAttempt,VisibleKey(snapshot));
            if (hasMutedTiles) MarkPair(null);
            for (int i = 0; i < stones.Count; i++)
            {
                stones[i].transform.position = positions[i] + Vector3.back * .15f;
                stones[i].transform.localScale = Vector3.one;
                SetMotionInk(stones[i], 1f, 0f);
                PaintStone(i, snapshot.values[i]);
                PaintFloor(i, snapshot.layers[i]);
            }
            PaintTerrain(snapshot.blockerHp, snapshot.cellOpen, snapshot.regionOpen);
            ClearSelection(); ClearEffects();
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
                stones[i].transform.localScale = focus ? Vector3.one * 1.025f : Vector3.one;
                if (guide || hasMutedTiles)
                {
                    float opacity = guide && !focus && !support ? .30f : 1f;
                    SetGuideOpacity(cells[i], opacity, authoredFloor ? .433f/1.055f : .485f*.875f/.926f);
                    float coveredFloor = authoredFloor ? .433f*.78f : .485f*.727f/.875f;
                    SetGuideOpacity(grounds[i], opacity, stones[i].activeSelf ? coveredFloor : 0);
                    SetGuideOpacity(stones[i], opacity);
                    if (numbers[i] != null)
                    {
                        Color label = numbers[i].color;
                        label.a = opacity;
                        numbers[i].color = label;
                    }
                }
            }
            hasMutedTiles = guide;
        }

        internal bool CanShowTutorialGesture => InputEnabled && !IsAnimating && pointer == int.MinValue &&
            selected < 0 && targetCell == null && CanPresent;

        private void MoveAlongSwap(int a, int b, float t)
        {
            Vector3 delta = positions[b] - positions[a];
            float arc = 4f * t * (1f - t);
            Vector3 offset = delta * t + new Vector3(delta.y, -delta.x, 0f) * (.14f * arc);
            Vector3 depth = Vector3.forward * StoneDepth;
            stones[a].transform.position = positions[a] + offset + depth + Vector3.back * (.40f * arc);
            stones[b].transform.position = positions[b] - offset + depth + Vector3.back * (.08f * arc);
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
            animation = StartCoroutine(Animate(receipt));
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
            ClearSelection();
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
            ClearSelection();
            ClearEffects(); Render(authoritative);
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
            if (wasDrag)
            {
                ClearSelection();
                return;
            }
            if (from != to) { ClearSelection(); return; }
            if (selected >= 0 && selected != to) { Request(selected, to); return; }
            Select(selected == to ? -1 : to);
        }
        public void OnCancel(BaseEventData data)
        {
            ResetGesture(); ClearSelection();
        }
        private void Request(int from, int to)
        {
            ClearSelection(); if (SwapRequested != null) SwapRequested(from, to);
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
        private void Select(int index)
        {
            ClearSelection(); selected = index;
            if (index < 0) return;
            selection = Make(assets == null ? null : assets.selectionEffect, "Selection", effectRoot);
            selection.transform.position = positions[index] + Vector3.back * .135f;
            Tint(selection, new Color(1, .91f, .47f));
        }
        private void ClearSelection()
        {
            selected = -1;
            if (selection != null) { selection.SetActive(false); Destroy(selection); }
            selection = null;
        }
        private void PaintStone(int i, int? value)
        {
            stones[i].SetActive(value.HasValue);
            if (numbers[i] != null) numbers[i].text = value.HasValue ? value.Value.ToString() : "";
            if (!value.HasValue) return;
            var tile = stones[i].GetComponent<CastleBoardTile>();
            if (tile != null && tile.Show(value.Value - 1))
            {
                Tint(stones[i], Color.white);
                return;
            }
            int palette = (value.Value % Colors.Length + Colors.Length) % Colors.Length;
            if (numbers[i] != null) numbers[i].color = Inks[palette];
            Tint(stones[i], Colors[palette], Edges[palette], .037f);
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
            selection = null;
        }
        private void ClearModels()
        {
            foreach (var o in cells) if (o != null) { o.SetActive(false); Destroy(o); }
            foreach (var o in grounds) if (o != null) { o.SetActive(false); Destroy(o); }
            foreach (var o in stones) if (o != null) { o.SetActive(false); Destroy(o); }
            cells.Clear(); grounds.Clear(); stones.Clear(); numbers.Clear(); motionInk.Clear();
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
            if (world != null) Destroy(world.gameObject);
            world = null; effectRoot = null; BoardCamera = null; tint = null;
        }
    }
}
