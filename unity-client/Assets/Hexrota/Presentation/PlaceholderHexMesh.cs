using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    /// <summary>Explicit temporary art, flat-top hex in XY with shallow depth. Contains no board rules.</summary>
    [ExecuteAlways, RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class PlaceholderHexMesh : MonoBehaviour
    {
        private static Mesh shared;
        private void OnEnable()
        {
            if (shared == null)
            {
                shared = new Mesh { name = "PLACEHOLDER_FlatTopHex_XY" };
                var vertices = new Vector3[14];
                var triangles = new int[72];
                vertices[0] = new Vector3(0, 0, -.045f);
                vertices[7] = new Vector3(0, 0, .045f);
                for (int i = 0; i < 6; i++)
                {
                    float angle = (i * 60) * Mathf.Deg2Rad;
                    vertices[i + 1] = new Vector3(Mathf.Cos(angle) * .56f, Mathf.Sin(angle) * .56f, -.045f);
                    vertices[i + 8] = new Vector3(vertices[i + 1].x, vertices[i + 1].y, .045f);
                    int next = (i + 1) % 6;
                    int t = i * 12;
                    triangles[t] = 0; triangles[t + 1] = next + 1; triangles[t + 2] = i + 1;
                    triangles[t + 3] = 7; triangles[t + 4] = i + 8; triangles[t + 5] = next + 8;
                    triangles[t + 6] = i + 1; triangles[t + 7] = next + 1; triangles[t + 8] = i + 8;
                    triangles[t + 9] = next + 1; triangles[t + 10] = next + 8; triangles[t + 11] = i + 8;
                }
                shared.vertices = vertices; shared.triangles = triangles;
                shared.RecalculateNormals(); shared.RecalculateBounds();
            }
            GetComponent<MeshFilter>().sharedMesh = shared;
        }
    }
}
