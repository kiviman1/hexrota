using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClient.Editor
{
    // Keep every original FBX part available to artists. On the board, the body,
    // relief and outlined digit share one draw call and one animation mask.
    internal sealed class StoneReliefImporter : AssetPostprocessor
    {
        private void OnPostprocessModel(GameObject root)
        {
            if (assetImporter.userData != "HexrotaToneRelief") return;
            var positions = new List<Vector3>();
            var normals = new List<Vector3>();
            var colors = new List<Color>();
            var indices = new List<int>();
            foreach (var renderer in root.GetComponentsInChildren<MeshRenderer>(true))
            {
                var part = renderer.GetComponent<MeshFilter>().sharedMesh;
                var palette = renderer.sharedMaterials;
                var vertices = part.vertices;
                var shading = part.normals;
                var toModel = renderer.transform.localToWorldMatrix;
                var toNormal = toModel.inverse.transpose;
                for (int s = 0; s < part.subMeshCount; s++)
                {
                    var pigment = palette[s].color;
                    var remap = new Dictionary<int, int>();
                    foreach (int vertex in part.GetTriangles(s))
                    {
                        if (!remap.TryGetValue(vertex, out int index))
                        {
                            index = positions.Count;
                            remap.Add(vertex, index);
                            positions.Add(toModel.MultiplyPoint3x4(vertices[vertex]));
                            normals.Add(toNormal.MultiplyVector(shading[vertex]).normalized);
                            colors.Add(pigment);
                        }
                        indices.Add(index);
                    }
                }
            }

            string number = Path.GetFileNameWithoutExtension(assetPath).Split('_')[1].TrimStart('0');
            var mesh = new Mesh { name = "ToneRelief_" + number };
            mesh.SetVertices(positions);
            mesh.SetNormals(normals);
            mesh.SetColors(colors);
            mesh.SetTriangles(indices, 0);
            context.AddObjectToAsset("HexrotaToneRelief", mesh);
        }

        public override uint GetVersion() => 1;
    }
}
