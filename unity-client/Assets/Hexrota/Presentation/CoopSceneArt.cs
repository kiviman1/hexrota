using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Pure projection of web scene-config-v1. Progress belongs to the session.
    public sealed class CoopSceneArt : MonoBehaviour
    {
        private RawImage landscape, shade, lessonShade;
        private RectTransform boardTray;
        private float entranceSlide = 1f;
        private Texture2D skyGradient;
        private int stage = -1;
        private int width, height;

        public static CoopSceneArt Create(Camera background, Camera board, RectTransform trayPrefab)
        {
            var canvasObject = new GameObject("CoopBackdrop", typeof(RectTransform), typeof(Canvas));
            canvasObject.transform.SetParent(background.transform, false);
            canvasObject.layer = LayerMask.NameToLayer("UI");
            background.cullingMask = 1 << canvasObject.layer;
            board.cullingMask &= ~background.cullingMask;
            board.clearFlags = CameraClearFlags.Depth;
            var canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = background;
            canvas.planeDistance = 1;
            var scaler = canvasObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(720, 1280);
            scaler.matchWidthOrHeight = .5f;
            var art = canvasObject.AddComponent<CoopSceneArt>();
            art.landscape = Picture("CoopLandscape", canvasObject.transform);
            art.shade = Picture("PlaySceneWash",canvasObject.transform);
            art.skyGradient = new Texture2D(1,64,TextureFormat.RGBA32,false);
            art.skyGradient.wrapMode = TextureWrapMode.Clamp;
            var pixels = new Color32[64];
            for (int i = 0; i < pixels.Length; i++)
            {
                float fromTop = 1 - i / 63f;
                Color top = new Color32(27,39,53,90), ridge = new Color32(27,39,53,138), bottom = new Color32(20,44,38,120);
                pixels[i] = fromTop < .22f ? Color.Lerp(top,ridge,fromTop/.22f) : Color.Lerp(ridge,bottom,(fromTop-.22f)/.78f);
            }
            art.skyGradient.SetPixels32(pixels); art.skyGradient.Apply(false,true);
            art.shade.texture = art.skyGradient;
            art.boardTray = Instantiate(trayPrefab, canvasObject.transform, false);
            art.boardTray.gameObject.SetActive(false);
            art.lessonShade = Picture("LessonBackdrop", canvasObject.transform);
            art.lessonShade.color = new Color32(20, 16, 36, 185);
            art.lessonShade.gameObject.SetActive(false);
            return art;
        }

        internal void FocusLesson(bool focus)
        {
            if (lessonShade != null) lessonShade.gameObject.SetActive(focus);
        }

        private static RawImage Picture(string name, Transform parent)
        {
            var picture = new GameObject(name, typeof(RectTransform), typeof(RawImage)).GetComponent<RawImage>();
            picture.transform.SetParent(parent, false);
            picture.gameObject.layer = LayerMask.NameToLayer("UI");
            picture.rectTransform.anchorMin = Vector2.zero;
            picture.rectTransform.anchorMax = Vector2.one;
            picture.rectTransform.offsetMin = picture.rectTransform.offsetMax = Vector2.zero;
            picture.raycastTarget = false;
            return picture;
        }

        public void Refresh(bool firstComplete, bool secondComplete, bool menu, bool showBoard)
        {
            int next = (firstComplete ? 1 : 0) + (secondComplete ? 1 : 0);
            if (next != stage)
            {
                stage = next;
                string name = stage == 0 ? "foundation" : stage == 1 ? "frame" : "finished";
                landscape.texture = Resources.Load<Texture2D>("CoopArt/" + name);
                ResizeLandscape();
            }
            shade.gameObject.SetActive(!menu);
            boardTray.gameObject.SetActive(showBoard);
        }

        public void SetBoardArea(Rect viewport, HexBoardView board, int cellCount)
        {
            if (boardTray == null || cellCount == 0 || board.BoardCamera == null) return;
            Vector2 frame = board.FrameVerticalLimits();
            // Include the outer half-hex and breathing room around the top and bottom rows.
            // The background camera draws the tray behind the world-space models and their input plane.
            float margin = .74f / (2f * board.BoardCamera.orthographicSize);
            boardTray.anchorMin = new Vector2(viewport.xMin, viewport.yMin + viewport.height * Mathf.Max(0, frame.x - margin));
            boardTray.anchorMax = new Vector2(viewport.xMax, viewport.yMin + viewport.height * Mathf.Min(1, frame.y + margin));
            boardTray.offsetMin = boardTray.offsetMax = Vector2.zero;
            SetEntranceSlide(entranceSlide);
        }

        internal void SetEntranceSlide(float progress)
        {
            entranceSlide = Mathf.Clamp01(progress);
            if (boardTray != null)
                boardTray.anchoredPosition = Vector2.right * ((1f - entranceSlide) * ((RectTransform)boardTray.parent).rect.width);
        }

        private void OnDestroy() { if (skyGradient != null) Destroy(skyGradient); }

        private void LateUpdate()
        {
            if (Screen.width != width || Screen.height != height) ResizeLandscape();
        }

        private void ResizeLandscape()
        {
            width = Screen.width; height = Screen.height;
            if (landscape == null || landscape.texture == null || height == 0) return;
            float aspect = (float)width / height;
            float source = (float)landscape.texture.width / landscape.texture.height;
            float u = Mathf.Min(1, aspect / source), v = Mathf.Min(1, source / aspect);
            landscape.uvRect = new Rect((1-u)/2, (1-v)/2, u, v);
        }
    }
}
