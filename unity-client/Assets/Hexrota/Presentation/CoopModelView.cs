using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // The 3D coop on the home plot. A small stage far from everything else holds the level model
    // (CP_L0 = the bare foundation at level 0, CP_L1..CP_L4 = coop levels) on two blob shadows; its own
    // camera renders it into a transparent render texture that this RawImage shows inside
    // Background/ArtFrame/CoopPlot. The coop therefore sorts like the UI it sits in: in front of the
    // painted background, behind every control, whatever the canvas mode.
    // The model follows the scale of the coop's UI targets, so the upgrade squash and the ready pulse
    // that animate those RectTransforms also play on the model.
    [DisallowMultipleComponent]
    [RequireComponent(typeof(RawImage))]
    public sealed class CoopModelView : MonoBehaviour
    {
        /// <summary>Unnamed layer used only by the coop stage and its camera.</summary>
        public const int StageLayer = 30;
        private static int stageCount;

        [Tooltip("Key light, shadow tint, rim, grounding and grade (pushed to the materials every frame).")]
        [SerializeField] private CoopLook look;
        [Tooltip("Level models in order: CP_L0 (foundation) .. CP_L4.")]
        [SerializeField] private GameObject[] levels = new GameObject[0];
        [Tooltip("One stylised-lit material per level (its albedo texture).")]
        [SerializeField] private Material[] materials = new Material[0];
        [SerializeField] private Material shadowMaterial;
        [Tooltip("Where the model's ground centre lands on the plot.")]
        [SerializeField] private RectTransform groundPoint;
        [Tooltip("UI targets whose scale (relative to rest) the model copies: upgrade squash and ready pulse.")]
        [SerializeField] private RectTransform scaleSource, pulseSource;

        [Header("Camera")]
        [Tooltip("Looks down on the coop like the painted background (degrees).")]
        [Range(0f, 89f)] [SerializeField] private float pitch = 30f;
        [Range(1f, 90f)] [SerializeField] private float fieldOfView = 20f;
        [Tooltip("On-screen width of one metre at the ground point, in canvas points.")]
        [Min(1f)] [SerializeField] private float pointsPerMeter = 230f;
        [Min(64)] [SerializeField] private int maxTextureSize = 1024;
        [Tooltip("Anti-aliasing samples for the coop texture; lowered to what the device supports.")]
        [SerializeField] private int msaaSamples = 4;

        private RawImage view;
        private Transform stage, modelRoot, contact, occlusion;
        private MaterialPropertyBlock litBlock, contactBlock, occlusionBlock;
        private Camera stageCamera;
        private RenderTexture target;
        private GameObject[] instances = new GameObject[0];
        private Vector3 scaleRest = Vector3.one, pulseRest = Vector3.one;
        private int shown = -1;

        public int Level => shown;
        public Camera StageCamera => stageCamera;
        public Transform Model => modelRoot;
        public RenderTexture Texture => target;
        public CoopLook Look => look;
        public Renderer ContactShadow => contact != null ? contact.GetComponent<Renderer>() : null;
        public int LevelCount => levels.Length;
        /// <summary>Name of the model shown (CP_L0 .. CP_L4), or null.</summary>
        public string ShownName => shown >= 0 && shown < instances.Length && instances[shown] != null ? instances[shown].name : null;
        public Renderer ShownRenderer =>
            shown >= 0 && shown < instances.Length && instances[shown] != null ? instances[shown].GetComponentInChildren<Renderer>() : null;

        private void Awake()
        {
            view = GetComponent<RawImage>();
            view.raycastTarget = false;
            if (scaleSource != null) scaleRest = scaleSource.localScale;
            if (pulseSource != null) pulseRest = pulseSource.localScale;
            BuildStage();
            Show(Mathf.Max(0, shown));
        }

        private void BuildStage()
        {
            // Each home instance gets its own stage, far below the scene, so tests can host several.
            stage = new GameObject("CoopStage").transform;
            stage.position = new Vector3(0, -1000f - 50f * stageCount++, 0);
            stage.gameObject.hideFlags = HideFlags.DontSave;
            modelRoot = new GameObject("Coop").transform;
            modelRoot.SetParent(stage, false);
            instances = new GameObject[levels.Length];
            for (int i = 0; i < levels.Length; i++)
            {
                if (levels[i] == null) continue;
                var model = Instantiate(levels[i], modelRoot, false);
                model.name = levels[i].name;
                foreach (var renderer in model.GetComponentsInChildren<Renderer>(true))
                {
                    if (i < materials.Length && materials[i] != null) renderer.sharedMaterial = materials[i];
                    renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    renderer.receiveShadows = false;
                }
                SetLayer(model.transform);
                model.SetActive(false);
                instances[i] = model;
            }
            litBlock = new MaterialPropertyBlock();
            contactBlock = new MaterialPropertyBlock();
            occlusionBlock = new MaterialPropertyBlock();
            contact = Blob("ContactShadow", .002f);
            occlusion = Blob("OcclusionShadow", .003f);

            stageCamera = new GameObject("CoopCamera").AddComponent<Camera>();
            stageCamera.transform.SetParent(stage, false);
            stageCamera.clearFlags = CameraClearFlags.SolidColor;
            stageCamera.backgroundColor = Color.clear;
            stageCamera.cullingMask = 1 << StageLayer;
            stageCamera.fieldOfView = fieldOfView;
            stageCamera.nearClipPlane = .05f;
            stageCamera.farClipPlane = 50f;
            stageCamera.allowHDR = false;
            stageCamera.allowMSAA = true;
            stageCamera.depth = -100;
            stageCamera.gameObject.layer = StageLayer;
        }

        // A ground quad with the blob shader (soft, premultiplied); drawn under the model.
        private Transform Blob(string name, float height)
        {
            var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Destroy(quad.GetComponent<Collider>());
            quad.name = name;
            var t = quad.transform;
            t.SetParent(stage, false);
            t.localPosition = new Vector3(0, height, 0);
            t.localRotation = Quaternion.Euler(90, 0, 0);
            var renderer = quad.GetComponent<MeshRenderer>();
            if (shadowMaterial != null) renderer.sharedMaterial = shadowMaterial;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            SetLayer(t);
            return t;
        }

        private static void SetLayer(Transform root)
        {
            foreach (var child in root.GetComponentsInChildren<Transform>(true)) child.gameObject.layer = StageLayer;
        }

        /// <summary>Shows the model for a coop level (0 = foundation); levels past the last show the last.</summary>
        public void Show(int level)
        {
            if (instances.Length == 0) { shown = level; return; }
            level = Mathf.Clamp(level, 0, instances.Length - 1);
            if (shown == level && instances[level] != null && instances[level].activeSelf) return;
            for (int i = 0; i < instances.Length; i++)
                if (instances[i] != null) instances[i].SetActive(i == level);
            shown = level;
        }

        private void OnEnable()
        {
            if (stage != null) stage.gameObject.SetActive(true);
            // Other cameras never draw the stage.
            foreach (var other in Camera.allCameras)
                if (other != stageCamera) other.cullingMask &= ~(1 << StageLayer);
        }

        private void OnDisable()
        {
            if (stage != null) stage.gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (stage != null) Destroy(stage.gameObject);
            if (target != null) { target.Release(); Destroy(target); }
        }

        private void LateUpdate() => Refresh();

        /// <summary>Fits the camera and texture to the current rect and copies the UI scale; safe to call any time.</summary>
        public void Refresh()
        {
            if (stageCamera == null) return;
            var rect = ((RectTransform)transform).rect;
            if (rect.width <= 1 || rect.height <= 1) return;
            FitTexture(rect);
            FitCamera(rect);
            CopyScale();
            ApplyLook();
        }

        private void ApplyLook()
        {
            if (look == null) return;
            var renderer = ShownRenderer;
            if (renderer != null)
            {
                look.ApplyLit(litBlock, stageCamera.transform.rotation);
                renderer.SetPropertyBlock(litBlock);
            }
            look.ApplyBlob(contactBlock, true);
            contact.GetComponent<Renderer>().SetPropertyBlock(contactBlock);
            look.ApplyBlob(occlusionBlock, false);
            occlusion.GetComponent<Renderer>().SetPropertyBlock(occlusionBlock);
        }

        private void FitTexture(Rect rect)
        {
            var canvas = view.canvas != null ? view.canvas.rootCanvas : null;
            float pixels = canvas != null ? canvas.scaleFactor : 1f;
            pixels *= transform.lossyScale.x / Mathf.Max(1e-5f, canvas != null ? canvas.transform.lossyScale.x : 1f);
            float shrink = Mathf.Min(1f, maxTextureSize / Mathf.Max(rect.width * pixels, rect.height * pixels));
            int width = Mathf.Max(16, Mathf.RoundToInt(rect.width * pixels * shrink));
            int height = Mathf.Max(16, Mathf.RoundToInt(rect.height * pixels * shrink));
            if (target != null && target.width == width && target.height == height) return;
            if (target != null) { stageCamera.targetTexture = null; target.Release(); Destroy(target); }
            var descriptor = new RenderTextureDescriptor(width, height, RenderTextureFormat.ARGB32, 24) { msaaSamples = Mathf.Max(1, msaaSamples) };
            descriptor.msaaSamples = Mathf.Max(1, Mathf.Min(descriptor.msaaSamples, SystemInfo.GetRenderTextureSupportedMSAASampleCount(descriptor)));
            target = new RenderTexture(descriptor) { name = "CoopModel", hideFlags = HideFlags.DontSave };
            target.Create();
            stageCamera.targetTexture = target;
            view.texture = target;
        }

        // Perspective camera pitched like the background; distance gives pointsPerMeter at the ground
        // point, and the camera is offset in its own plane so the ground centre lands on groundPoint.
        private void FitCamera(Rect rect)
        {
            stageCamera.fieldOfView = fieldOfView;
            stageCamera.aspect = rect.width / rect.height;
            float distance = rect.height / (2f * Mathf.Tan(fieldOfView * .5f * Mathf.Deg2Rad) * pointsPerMeter);
            // The exported models face -Z (door/gate side); the camera stands on that side looking +Z.
            var rotation = Quaternion.Euler(pitch, 0, 0);
            Vector2 anchor = Vector2.zero;
            if (groundPoint != null)
            {
                Vector2 local = transform.InverseTransformPoint(groundPoint.TransformPoint(groundPoint.rect.center));
                anchor = local - rect.center; // points from the rect centre
            }
            // Moving the camera by -offset shifts the ground point on screen by +offset.
            Vector3 offset = rotation * new Vector3(anchor.x, anchor.y, 0) / pointsPerMeter;
            stageCamera.transform.localRotation = rotation;
            stageCamera.transform.localPosition = -(rotation * Vector3.forward) * distance - offset;
        }

        private void CopyScale()
        {
            Vector3 s = Vector3.one;
            if (scaleSource != null) s = Vector3.Scale(s, Divide(scaleSource.localScale, scaleRest));
            if (pulseSource != null) s = Vector3.Scale(s, Divide(pulseSource.localScale, pulseRest));
            // UI x is the model's width (x and depth), UI y its height.
            var scale = new Vector3(s.x, s.y, s.x);
            if (modelRoot.localScale != scale) modelRoot.localScale = scale;
            // Blob shadows follow the footprint of the shown model (and its squash).
            var shownRenderer = ShownRenderer;
            if (shownRenderer != null && look != null)
            {
                var size = shownRenderer.bounds.size;
                contact.localScale = new Vector3(size.x * look.contactScale, size.z * look.contactScale, 1);
                occlusion.localScale = new Vector3(size.x * look.occlusionScale, size.z * look.occlusionScale, 1);
            }
        }

        private static Vector3 Divide(Vector3 a, Vector3 b) =>
            new Vector3(b.x != 0 ? a.x / b.x : 1, b.y != 0 ? a.y / b.y : 1, b.z != 0 ? a.z / b.z : 1);
    }
}
