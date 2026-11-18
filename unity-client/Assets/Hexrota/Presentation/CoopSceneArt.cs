using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Pure projection of web scene-config-v1. Progress belongs to the session.
    public sealed class CoopSceneArt : MonoBehaviour
    {
        private RawImage landscape, actor;
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
            art.actor = Picture("TavikPortrait", safe);
            art.actor.transform.SetAsFirstSibling();
            art.actor.texture = Resources.Load<Texture2D>("CoopArt/inspect");
            if (art.actor.texture != null)
            {
                var fit = art.actor.gameObject.AddComponent<AspectRatioFitter>();
                fit.aspectRatio = (float)art.actor.texture.width / art.actor.texture.height;
                fit.aspectMode = AspectRatioFitter.AspectMode.WidthControlsHeight;
            }
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
            actor.gameObject.SetActive(menu && actor.texture != null);
            var rect = actor.rectTransform;
            rect.anchorMin = firstOpening ? new Vector2(.265f,.60f) : new Vector2(.655f,.65f);
            rect.anchorMax = firstOpening ? new Vector2(.735f,.60f) : new Vector2(.925f,.65f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(0, rect.sizeDelta.y);
            landscape.color = menu ? Color.white : new Color(.76f,.73f,.77f);
        }

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
