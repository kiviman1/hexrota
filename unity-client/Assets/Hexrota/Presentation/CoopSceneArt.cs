using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Pure projection of web scene-config-v1. Progress belongs to the session.
    public sealed class CoopSceneArt : MonoBehaviour
    {
        private RawImage landscape, shade;
        private Texture2D skyGradient;
        private int stage = -1;
        private int width, height;

        public static CoopSceneArt Create(RectTransform safe, Camera background, Camera board)
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
            return art;
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

        public void Refresh(bool firstComplete, bool secondComplete, bool menu, bool firstOpening = false)
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
