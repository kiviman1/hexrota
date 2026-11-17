using System;
using System.Collections.Generic;
using Hexrota.Gameplay;

namespace Hexrota.Catalog
{
    public sealed class CatalogException : ArgumentException
    {
        public readonly string Code;
        public CatalogException(string code, string message) : base(message) { Code = code; }
    }
    public sealed class AttemptMetadata
    {
        public readonly int attemptVersion;
        public readonly object levelId;
        public readonly string variantId, levelDataVersion, attemptId;
        public readonly long attemptSerial;
        public AttemptMetadata(object levelId, string variantId, string levelDataVersion, string attemptId, long attemptSerial)
        { attemptVersion = 1; this.levelId = levelId; this.variantId = variantId; this.levelDataVersion = levelDataVersion; this.attemptId = attemptId; this.attemptSerial = attemptSerial; }
        public Dictionary<string, object> ToWire() { return new Dictionary<string, object> { { "attemptVersion", attemptVersion }, { "levelId", levelId }, { "variantId", variantId }, { "levelDataVersion", levelDataVersion }, { "attemptId", attemptId }, { "attemptSerial", attemptSerial } }; }
    }
    public sealed class AttemptStart
    {
        public readonly AttemptMetadata Metadata;
        private readonly Dictionary<string, object> level;
        public readonly uint SelectionSeed;
        public Dictionary<string, object> LevelWire { get { return CatalogWire.CopyMap(level); } }
        public AttemptStart(AttemptMetadata metadata, Dictionary<string, object> level, uint selectionSeed) { Metadata = metadata; this.level = CatalogWire.CopyMap(level); SelectionSeed = selectionSeed; }
        public Dictionary<string, object> ToWire() { return new Dictionary<string, object> { { "metadata", Metadata.ToWire() }, { "level", LevelWire }, { "selectionSeed", SelectionSeed } }; }
    }
    public sealed class AttemptCheckpoint
    {
        public readonly AttemptMetadata Metadata;
        private readonly Dictionary<string, object> level;
        public readonly HexMatch Game;
        public readonly bool Legacy;
        public Dictionary<string, object> LevelWire { get { return CatalogWire.CopyMap(level); } }
        public GameSnapshot Snapshot { get { return Game.Snapshot(); } }
        public AttemptCheckpoint(AttemptMetadata metadata, Dictionary<string, object> level, HexMatch game, bool legacy) { Metadata = metadata; this.level = CatalogWire.CopyMap(level); Game = game; Legacy = legacy; }
        public Dictionary<string, object> ToWire() { return new Dictionary<string, object> { { "metadata", Metadata.ToWire() }, { "level", LevelWire }, { "snapshot", CatalogWire.Snapshot(Game.Snapshot()) }, { "legacy", Legacy } }; }
        public Dictionary<string, object> Envelope() { var result = Metadata.ToWire(); result.Add("snapshot", CatalogWire.Snapshot(Game.Snapshot())); return result; }
    }
}
