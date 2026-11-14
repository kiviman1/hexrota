using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using Hexrota.Gameplay;
using Hexrota.Contracts;

namespace Hexrota.Catalog
{
    // JSON transport is deliberately outside the core. These are portable JSON values.
    public static class CatalogWire
    {
        public const long MaxSafeInteger = Wire.MaxSafeInteger;
        public static IDictionary<string, object> Map(object value) { return value as IDictionary<string, object>; }
        public static IList List(object value) { return value as IList; }
        public static object Get(object value, string name) { return Wire.Get(value, name); }
        public static bool Has(object value, string name) { return Wire.Has(value, name); }
        public static bool Number(object value) { return Wire.IsNumber(value); }
        public static bool Integer(object value, double min = -MaxSafeInteger, double max = MaxSafeInteger) { return Wire.IsSafeInteger(value) && Wire.Number(value) >= min && Wire.Number(value) <= max; }
        public static long Long(object value) { return Wire.Integer(value); }
        public static int Int(object value) { return Wire.Int32(value); }
        public static bool Same(object a, object b) { return Number(a) && Number(b) ? Wire.Number(a) == Wire.Number(b) : Object.Equals(a, b); }
        public static string Text(object value) { return Wire.JsString(value); }
        public static object Clone(object value) { return Wire.Clone(value); }
        public static Dictionary<string, object> CopyMap(object value) { return Wire.Copy(value); }
        public static int[][] Route(object value)
        {
            var source = List(value); if (source == null) throw new ArgumentException("Invalid checkpoint history");
            var result = new int[source.Count][];
            for (int i = 0; i < result.Length; i++) { var pair = List(source[i]); if (pair == null || pair.Count != 2) throw new ArgumentException("Invalid checkpoint history"); result[i] = new[] { Int(pair[0]), Int(pair[1]) }; }
            return result;
        }
        public static LevelConfig ReadLevel(object value)
        {
            var cells = List(Get(value, "cells")); var initial = List(Get(value, "initial")); var palette = List(Get(value, "palette"));
            if (cells == null || initial == null || palette == null || !Integer(Get(value, "seed"), 0, UInt32.MaxValue)) throw new ArgumentException("Invalid gameplay configuration");
            var result = new LevelConfig { id = Clone(Get(value, "id")), cells = new Cell[cells.Count], initial = new int?[initial.Count], palette = new int[palette.Count], seed = (uint)Long(Get(value, "seed")), moves = Int(Get(value, "moves")), target = Int(Get(value, "target")), targetMode = Get(value, "targetMode") as string };
            if (Get(value, "rulesVersion") is string) result.rulesVersion = (string)Get(value, "rulesVersion");
            for (int i = 0; i < result.cells.Length; i++) result.cells[i] = new Cell { q = Int(Get(cells[i], "q")), r = Int(Get(cells[i], "r")), layers = Get(cells[i], "layers") == null || Same(Get(cells[i], "layers"), 0) ? 1 : Int(Get(cells[i], "layers")) };
            for (int i = 0; i < result.initial.Length; i++) result.initial[i] = initial[i] == null ? (int?)null : Int(initial[i]);
            for (int i = 0; i < result.palette.Length; i++) result.palette[i] = Int(palette[i]);
            return result;
        }
        public static GameSnapshot ReadSnapshot(object value)
        {
            var map = Map(value); var values = List(Get(value, "values")); var layers = List(Get(value, "layers"));
            if (map == null || values == null || layers == null || !(Get(value, "rulesVersion") is string) || !Integer(Get(value, "rngState"), 1, UInt32.MaxValue)) throw new ArgumentException("Invalid match-three checkpoint");
            try {
                var result = new GameSnapshot { version = Int(Get(value, "version")), rulesVersion = (string)Get(value, "rulesVersion"), values = new int?[values.Count], layers = new int[layers.Count], score = Int(Get(value, "score")), movesLeft = Int(Get(value, "movesLeft")), turn = Int(Get(value, "turn")), rngState = (uint)Long(Get(value, "rngState")), history = Route(Get(value, "history")) };
                for (int i = 0; i < values.Count; i++) result.values[i] = values[i] == null ? (int?)null : Int(values[i]);
                for (int i = 0; i < layers.Count; i++) result.layers[i] = Int(layers[i]);
                return result;
            } catch (ArgumentException) { throw new ArgumentException("Invalid match-three checkpoint"); }
        }
        public static Dictionary<string, object> Snapshot(GameSnapshot snapshot)
        {
            return new Dictionary<string, object> { { "version", snapshot.version }, { "rulesVersion", snapshot.rulesVersion }, { "values", Clone(snapshot.values) }, { "layers", Clone(snapshot.layers) }, { "score", snapshot.score }, { "movesLeft", snapshot.movesLeft }, { "turn", snapshot.turn }, { "rngState", snapshot.rngState }, { "history", Clone(snapshot.history) } };
        }
    }
}
