using System;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // Swap the artwork on an existing renderer so falls, hints and selection
    // continue to address the same animated stone and its independent number.
    [DisallowMultipleComponent]
    public sealed class CastleBoardTile : MonoBehaviour
    {
        [Serializable]
        public struct Variant
        {
            public Mesh mesh;
            public Material material;
        }

        [SerializeField] private MeshFilter model;
        [SerializeField] private MeshRenderer surface;
        [Tooltip("Stones use values 1–5 in order. Floors use soil, partly cleared, then green.")]
        [SerializeField] private Variant[] variants;

        internal bool Show(int index)
        {
            if (model == null || surface == null || variants == null ||
                index < 0 || index >= variants.Length) return false;
            var variant = variants[index];
            if (variant.mesh == null || variant.material == null) return false;
            if (model.sharedMesh != variant.mesh) model.sharedMesh = variant.mesh;
            if (surface.sharedMaterial != variant.material) surface.sharedMaterial = variant.material;
            return true;
        }
    }
}
