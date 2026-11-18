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
    public sealed class HexBoardView : MonoBehaviour, IPointerDownHandler, IPointerUpHandler,
        IDragHandler, ICancelHandler
    {
        public event Action<int, int> SwapRequested;
        public event Action PresentationCompleted;
        public event Action PresentationCancelled;
        public Camera BoardCamera { get; private set; }
        public bool IsAnimating { get; private set; }
        public bool InputEnabled { get; set; }
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
        private bool tutorialLayout, hasMutedTiles;

        private int selected = -1, pressed = -1, pointer = int.MinValue;
        private Vector2 down;
        private bool dragged;
        private GameObject selection;
        private Coroutine animation;
        private MaterialPropertyBlock tint;
        private static readonly Color[] Colors = {
            new Color32(235,227,245,255), new Color32(179,101,242,255),
            new Color32(255,207,40,255), new Color32(255,104,81,255),
            new Color32(39,159,237,255), new Color32(241,92,189,255)
        };

        private void Awake() { tint = new MaterialPropertyBlock(); }

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
            world = new GameObject("BoardVisuals_PLACEHOLDER").transform;
            world.SetParent(transform, false);
            // Canvas children cannot own world-space model transforms. Keep the
            // visual root outside the canvas and explicitly dispose it on destroy.
            world.SetParent(null, false);
            effectRoot = new GameObject("Effects").transform;
            effectRoot.SetParent(world, false);
        }

        public void Build(LevelConfig level, GameSnapshot snapshot)
        {
            if (this == null || world == null || effectRoot == null) return;
            Cancel(snapshot); ClearModels(); positions = new Vector3[level.cells.Length];
            tutorialLayout = level.id is string;
            for (int i = 0; i < level.cells.Length; i++)
            {
                Vector2 xy = MobileLayout.Axial(level.cells[i].q, level.cells[i].r);
                positions[i] = new Vector3(xy.x, xy.y, 0);
                var cell = Make(assets == null ? null : assets.cell, "Cell_" + i, world);
                cell.transform.position = positions[i] + Vector3.forward * .12f;
                cells.Add(cell);
                var ground = Make(assets == null ? null : assets.ground, "Ground_" + i, world);
                ground.transform.position = positions[i]; grounds.Add(ground);
                var stone = new GameObject("Stone_" + i);
                stone.transform.SetParent(world, false);
                Make(assets == null ? null : assets.stone, "StoneModel_PLACEHOLDER", stone.transform);
                stone.transform.position = positions[i] + Vector3.back * .15f; stones.Add(stone);
                var labelObject = new GameObject("Value_" + i);
                labelObject.transform.SetParent(stone.transform, false);
                labelObject.transform.localPosition = new Vector3(0, 0, -.38f);
                var text = labelObject.AddComponent<TextMesh>();
                text.anchor = TextAnchor.MiddleCenter; text.alignment = TextAlignment.Center;
                text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                text.GetComponent<MeshRenderer>().sharedMaterial = text.font.material;
                text.fontSize = 64; text.characterSize = .065f; text.color = new Color(.07f,.10f,.13f);
                numbers.Add(text);
            }
            Render(snapshot); FitCamera();
        }

        public void SetViewport(Rect safe)
        {
            if (BoardCamera == null) return;
            BoardCamera.rect = MobileLayout.BoardViewport(safe); FitCamera();
        }

        private void FitCamera()
        {
            if (BoardCamera == null || positions == null || positions.Length == 0) return;
            var bounds = new Bounds(positions[0], Vector3.zero);
            foreach (Vector3 position in positions) bounds.Encapsulate(position);
            float aspect = Mathf.Max(.1f, BoardCamera.pixelRect.width / Mathf.Max(1, BoardCamera.pixelRect.height));
            BoardCamera.orthographicSize = Mathf.Max(bounds.extents.y + .65f, (bounds.extents.x + .65f) / aspect);
            // Web's tutorial viewBox reserves at least 275 x 260 units at an
            // axial step of 44. Keep that breathing room on small lesson boards.
            if (tutorialLayout)
                BoardCamera.orthographicSize = Mathf.Max(BoardCamera.orthographicSize,
                    .5f * .56f / 44f * Mathf.Max(260, 275 / aspect));
            BoardCamera.transform.position = new Vector3(bounds.center.x, bounds.center.y, -20);
            BoardCamera.transform.rotation = Quaternion.identity;
        }

        public void Render(GameSnapshot snapshot)
        {
            if (snapshot == null) return;
            if (!HasVisuals || stones.Count != snapshot.values.Length) return;
            if (hasMutedTiles) MarkPair(null);
            for (int i = 0; i < stones.Count; i++)
            {
                stones[i].transform.position = positions[i] + Vector3.back * .15f;
                stones[i].transform.localScale = Vector3.one;
                PaintStone(i, snapshot.values[i]);
                Tint(grounds[i], snapshot.layers[i] == 0 ? new Color(.26f,.64f,.29f) :
                    snapshot.layers[i] == 1 ? new Color(.56f,.39f,.23f) : new Color(.40f,.29f,.20f));
                Tint(cells[i], new Color(.15f,.25f,.21f));
            }
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
                Tint(cells[i], focus || support ? new Color32(255, 244, 197, 255) : new Color(.15f,.25f,.21f));
                stones[i].transform.localScale = focus ? Vector3.one * 1.1f : Vector3.one;
                if (guide || hasMutedTiles)
                {
                    float opacity = guide && !focus && !support ? .32f : 1f;
                    SetGuideOpacity(cells[i], opacity);
                    SetGuideOpacity(grounds[i], opacity);
                    SetGuideOpacity(stones[i], opacity);
                    Color label = numbers[i].color;
                    label.a = opacity;
                    numbers[i].color = label;
                }
            }
            hasMutedTiles = guide;
        }

        private void SetGuideOpacity(GameObject tile, float opacity)
        {
            foreach (var renderer in tile.GetComponentsInChildren<Renderer>())
            {
                renderer.GetPropertyBlock(tint);
                tint.SetFloat("_GuideOpacity", opacity);
                renderer.SetPropertyBlock(tint);
            }
        }

        public void Present(MovePresentation receipt)
        {
            Cancel(receipt.Before);
            if (!CanPresent) return;
            IsAnimating = true;
            animation = StartCoroutine(Animate(receipt));
        }

        private IEnumerator Animate(MovePresentation receipt)
        {
            // The UI selects the requested indices. A rejected swap is visualized
            // and returned without mutating a snapshot or spending a move.
            int a = receipt.A, b = receipt.B;
            if (a >= 0 && b >= 0 && a < stones.Count && b < stones.Count)
            {
                yield return SwapMotion(a, b, .16f);
                if (!HasVisuals) { Cancel(null); yield break; }
                if (!receipt.Ok) { yield return SwapMotion(a, b, .16f, true); }
            }
            if (!HasVisuals) { Cancel(null); yield break; }
            if (receipt.Ok && receipt.Swap != null)
            {
                foreach (WaveFrame wave in receipt.Swap.frames)
                {
                    for (int i = 0; i < stones.Count; i++)
                    {
                        stones[i].transform.position = positions[i] + Vector3.back * .15f;
                        PaintStone(i, wave.before[i]);
                    }
                    foreach (int i in wave.matched)
                        Spawn(assets == null ? null : assets.matchEffect, positions[i] + Vector3.back * .35f);
                    float elapsed = 0;
                    while (elapsed < .18f)
                    {
                        if (!HasVisuals) { Cancel(null); yield break; }
                        elapsed += Time.unscaledDeltaTime;
                        foreach (int i in wave.matched) stones[i].transform.localScale = Vector3.one * Mathf.Lerp(1, .02f, elapsed / .18f);
                        yield return null;
                    }
                    if (!HasVisuals) { Cancel(null); yield break; }
                    foreach (int i in wave.matched) Spawn(assets == null ? null : assets.clearEffect, positions[i]);
                    for (int i = 0; i < stones.Count; i++)
                    {
                        stones[i].transform.localScale = Vector3.one;
                        PaintStone(i, wave.after[i]);
                        Tint(grounds[i], wave.layers[i] == 0 ? new Color(.26f,.64f,.29f) : wave.layers[i] == 1 ? new Color(.56f,.39f,.23f) : new Color(.40f,.29f,.20f));
                    }
                    var starts = new Dictionary<int, Vector3>();
                    foreach (FallTile fall in wave.falls)
                    {
                        Vector3 start = fall.from.HasValue ? positions[fall.from.Value] :
                            positions[fall.to] + Vector3.up * (.97f * (fall.spawnOrder.GetValueOrDefault() + 1));
                        starts[fall.to] = start;
                        stones[fall.to].transform.position = start + Vector3.back * .15f;
                        Spawn(assets == null ? null : assets.fallEffect, start);
                    }
                    elapsed = 0;
                    while (elapsed < .26f)
                    {
                        if (!HasVisuals) { Cancel(null); yield break; }
                        elapsed += Time.unscaledDeltaTime;
                        float t = Mathf.SmoothStep(0, 1, Mathf.Clamp01(elapsed / .26f));
                        foreach (var entry in starts)
                            stones[entry.Key].transform.position = Vector3.Lerp(entry.Value, positions[entry.Key], t) + Vector3.back * .15f;
                        yield return null;
                    }
                    if (!HasVisuals) { Cancel(null); yield break; }
                    ClearEffects();
                }
            }
            Render(receipt.After); IsAnimating = false; animation = null;
            if (PresentationCompleted != null) PresentationCompleted();
        }

        private IEnumerator SwapMotion(int a, int b, float duration, bool reverse = false)
        {
            Vector3 startA = positions[reverse ? b : a] + Vector3.back * .15f;
            Vector3 startB = positions[reverse ? a : b] + Vector3.back * .15f;
            float elapsed = 0;
            while (elapsed < duration)
            {
                if (!HasVisuals) yield break;
                elapsed += Time.unscaledDeltaTime; float t = Mathf.SmoothStep(0, 1, elapsed / duration);
                stones[a].transform.position = Vector3.Lerp(startA, startB, t);
                stones[b].transform.position = Vector3.Lerp(startB, startA, t);
                yield return null;
            }
        }

        private Action<int> targetCell;

        public void SelectCellForItem(Action<int> onTap)
        {
            ClearSelection();
            targetCell = onTap;
        }

        public void Cancel(GameSnapshot authoritative)
        {
            targetCell = null;
            bool wasAnimating = IsAnimating;
            if (this != null && animation != null) StopCoroutine(animation);
            animation = null; IsAnimating = false;
            pointer = int.MinValue; pressed = -1; dragged = false; ClearSelection();
            ClearEffects(); Render(authoritative);
            if (wasAnimating && PresentationCancelled != null) PresentationCancelled();
        }

        public void OnPointerDown(PointerEventData e)
        {
            if (this == null || !isActiveAndEnabled || !HasVisuals || !InputEnabled || IsAnimating || pointer != int.MinValue) return;
            pointer = e.pointerId; down = e.position; pressed = Hit(e.position); dragged = false;
        }
        public void OnDrag(PointerEventData e)
        {
            if (e.pointerId != pointer) return;
            if (Vector2.Distance(down, e.position) > Mathf.Max(10, Screen.dpi > 0 ? Screen.dpi * .06f : 14)) dragged = true;
        }
        public void OnPointerUp(PointerEventData e)
        {
            if (e.pointerId != pointer) return;
            // StandaloneInputModule dispatches PointerUp for an interrupted
            // native touch as well. That interruption must never issue a move.
            for (int i = 0; i < Input.touchCount; i++)
            {
                Touch touch = Input.GetTouch(i);
                if (touch.fingerId == e.pointerId && touch.phase == TouchPhase.Canceled)
                {
                    pointer = int.MinValue; pressed = -1; dragged = false; ClearSelection(); return;
                }
            }
            int from = pressed, to = Hit(e.position); bool wasDrag = dragged;
            pointer = int.MinValue; pressed = -1; dragged = false;
            if (!InputEnabled || IsAnimating || from < 0 || to < 0) { ClearSelection(); return; }
            if (targetCell != null)
            {
                if (!wasDrag && from == to)
                {
                    var onTap = targetCell; targetCell = null;
                    onTap(to);
                }
                return;
            }
            if (wasDrag && from != to) { Request(from, to); return; }
            if (selected >= 0 && selected != to) { Request(selected, to); return; }
            Select(selected == to ? -1 : to);
        }
        public void OnCancel(BaseEventData data) { pointer = int.MinValue; pressed = -1; ClearSelection(); }
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
            selection.transform.position = positions[index] + Vector3.back * .07f;
            Tint(selection, new Color(1, .91f, .47f));
        }
        private void ClearSelection() { selected = -1; if (selection != null) Destroy(selection); selection = null; }
        private void PaintStone(int i, int? value)
        {
            stones[i].SetActive(value.HasValue);
            numbers[i].text = value.HasValue ? value.Value.ToString() : "";
            if (value.HasValue) Tint(stones[i], Colors[(value.Value % Colors.Length + Colors.Length) % Colors.Length]);
        }
        private void Tint(GameObject obj, Color color)
        {
            if (obj == null || tint == null) return;
            foreach (Renderer renderer in obj.GetComponentsInChildren<Renderer>())
            {
                if (renderer is MeshRenderer && renderer.GetComponent<TextMesh>() != null) continue;
                renderer.GetPropertyBlock(tint); tint.SetColor("_Color", color); tint.SetColor("_BaseColor", color);
                renderer.SetPropertyBlock(tint);
            }
        }
        private GameObject Make(GameObject prefab, string name, Transform parent)
        {
            return HexrotaAssetCatalog.InstantiateOrFallback(prefab, parent, name);
        }
        private void Spawn(GameObject prefab, Vector3 position)
        {
            var effect = Make(prefab, "Effect_PLACEHOLDER", effectRoot); effect.transform.position = position;
        }
        private void ClearEffects()
        {
            if (effectRoot == null) return;
            foreach (Transform child in effectRoot) Destroy(child.gameObject);
            selection = null;
        }
        private void ClearModels()
        {
            foreach (var o in cells) if (o != null) Destroy(o);
            foreach (var o in grounds) if (o != null) Destroy(o);
            foreach (var o in stones) if (o != null) Destroy(o);
            cells.Clear(); grounds.Clear(); stones.Clear(); numbers.Clear();
        }
        private void OnDisable() { InputEnabled = false; Cancel(null); }
        private void OnDestroy()
        {
            Cancel(null);
            SwapRequested = null; PresentationCompleted = null; PresentationCancelled = null;
            cells.Clear(); grounds.Clear(); stones.Clear(); numbers.Clear(); positions = null;
            if (world != null) Destroy(world.gameObject);
            world = null; effectRoot = null; BoardCamera = null; tint = null;
        }
    }
}
