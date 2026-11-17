using UnityEngine;
using Hexrota.Gameplay;

namespace Hexrota.Client
{
    // Disposable visual only. Index maps to the unchanged canonical C# engine.
    [RequireComponent(typeof(BoxCollider))]
    public sealed class HexrotaTileView : MonoBehaviour
    {
        private static Mesh floorMesh;
        private static Mesh gemMesh;
        private static Font sharedFont;
        private HexrotaTheme theme;
        private Renderer floorRenderer;
        private Renderer gemRenderer;
        private Material floorMaterial;
        private Material gemMaterial;
        private GameObject gemObject;
        private TextMesh number;
        private int renderedValue = -1;
        private bool renderedPrefab;
        public int Index { get; private set; }

        public void Initialize(int index, Cell cell, HexrotaTheme visualTheme)
        {
            Index = index;
            theme = visualTheme;
            name = "Hex " + index + " (" + cell.q + "," + cell.r + ")";
            transform.localPosition = new Vector3(
                1.08f * (cell.q + cell.r * 0.5f), 0f, 0.93f * cell.r);
            BoxCollider hit = GetComponent<BoxCollider>();
            hit.center = new Vector3(0f, 0.13f, 0f);
            hit.size = new Vector3(0.86f, 0.5f, 0.86f);

            if (theme != null && theme.floorPrefab != null)
            {
                var visual = Instantiate(theme.floorPrefab, transform, false);
                visual.name = "FloorVisual";
                floorRenderer = visual.GetComponentInChildren<Renderer>();
            }
            else
            {
                var floor = MakeSurface("FloorPlaceholder", Floor(), 0.05f, out floorMaterial);
                floorRenderer = floor.GetComponent<Renderer>();
            }

            var text = new GameObject("ValueLabel");
            text.transform.SetParent(transform, false);
            text.transform.localPosition = new Vector3(0f, 0.28f, 0f);
            text.transform.localRotation = Quaternion.Euler(-90f, 0f, 0f);
            number = text.AddComponent<TextMesh>();
            if (sharedFont == null)
            {
                sharedFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                if (sharedFont == null) sharedFont = Font.CreateDynamicFontFromOSFont("Arial", 64);
            }
            number.font = sharedFont;
            number.fontSize = 64;
            number.characterSize = 0.011f;
            number.anchor = TextAnchor.MiddleCenter;
            number.alignment = TextAlignment.Center;
            number.color = Color.white;
            MeshRenderer textRenderer = text.GetComponent<MeshRenderer>();
            if (sharedFont != null) textRenderer.sharedMaterial = sharedFont.material;
        }

        public void Refresh(int? value, int layers, bool selected)
        {
            Color ground = selected ? new Color(0.30f, 0.86f, 0.94f) :
                layers == 0 ? new Color(0.23f, 0.62f, 0.36f) :
                layers == 1 ? new Color(0.71f, 0.56f, 0.38f) :
                new Color(0.53f, 0.36f, 0.63f);
            if (floorMaterial != null) floorMaterial.color = ground;
            else if (floorRenderer != null)
            {
                var block = new MaterialPropertyBlock();
                floorRenderer.GetPropertyBlock(block);
                block.SetColor("_Color", ground);
                block.SetColor("_BaseColor", ground);
                floorRenderer.SetPropertyBlock(block);
            }

            int current = value.HasValue ? value.Value : -1;
            GameObject prefab = current < 0 || theme == null ? null : theme.GemFor(current);
            bool needsPrefab = prefab != null;
            if (gemObject == null || renderedValue != current || renderedPrefab != needsPrefab)
            {
                if (gemObject != null) Destroy(gemObject);
                if (gemMaterial != null) Destroy(gemMaterial);
                gemMaterial = null;
                gemRenderer = null;
                gemObject = null;
                if (current >= 0)
                {
                    if (needsPrefab)
                    {
                        gemObject = Instantiate(prefab, transform, false);
                        gemObject.name = "GemVisual_" + current;
                    }
                    else
                    {
                        gemObject = MakeSurface("GemPlaceholder", Gem(), 0.19f, out gemMaterial);
                        gemRenderer = gemObject.GetComponent<Renderer>();
                    }
                }
                renderedValue = current;
                renderedPrefab = needsPrefab;
            }
            if (gemMaterial != null) gemMaterial.color = GemColor(current);
            if (number != null)
            {
                number.text = current < 0 ? "" : current.ToString();
                number.gameObject.SetActive(current >= 0 &&
                    (!needsPrefab || (theme != null && theme.showNumbersOnPrefabs)));
            }
        }

        private GameObject MakeSurface(string title, Mesh mesh, float y, out Material material)
        {
            var obj = new GameObject(title);
            obj.transform.SetParent(transform, false);
            obj.transform.localPosition = new Vector3(0f, y, 0f);
            obj.AddComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = obj.AddComponent<MeshRenderer>();
            Shader shader = Shader.Find("Unlit/Color");
            if (shader == null) shader = Shader.Find("Standard");
            material = new Material(shader);
            renderer.sharedMaterial = material;
            return obj;
        }

        private static Mesh Floor() { return floorMesh ?? (floorMesh = Hexagon(0.55f)); }
        private static Mesh Gem() { return gemMesh ?? (gemMesh = Hexagon(0.37f)); }

        private static Mesh Hexagon(float radius)
        {
            var mesh = new Mesh { name = "Hexrota placeholder hexagon" };
            var vertices = new Vector3[7];
            var triangles = new int[18];
            for (int i = 0; i < 6; i++)
            {
                float angle = Mathf.Deg2Rad * (60f * i + 30f);
                vertices[i + 1] = new Vector3(Mathf.Cos(angle) * radius, 0f,
                    Mathf.Sin(angle) * radius);
                triangles[i * 3] = 0;
                triangles[i * 3 + 1] = (i + 1) % 6 + 1;
                triangles[i * 3 + 2] = i + 1;
            }
            mesh.vertices = vertices;
            mesh.triangles = triangles;
            mesh.RecalculateNormals();
            return mesh;
        }

        private static Color GemColor(int value)
        {
            switch (value)
            {
                case 1: return new Color(0.96f, 0.66f, 0.28f);
                case 2: return new Color(0.34f, 0.72f, 0.95f);
                case 3: return new Color(0.83f, 0.42f, 0.76f);
                case 4: return new Color(0.47f, 0.82f, 0.48f);
                case 5: return new Color(0.92f, 0.43f, 0.39f);
                default: return new Color(0.88f, 0.84f, 0.55f);
            }
        }

        private void OnDestroy()
        {
            if (floorMaterial != null) Destroy(floorMaterial);
            if (gemMaterial != null) Destroy(gemMaterial);
        }
    }
}
