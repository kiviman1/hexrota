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
            for (int i = 0; i < result.cells.Length; i++) result.cells[i] = new Cell { q = Int(Get(cells[i], "q")), r = Int(Get(cells[i], "r")), layers = Get(cells[i], "layers") == null || (result.rulesVersion != "classic-v5" && Same(Get(cells[i], "layers"), 0)) ? 1 : Int(Get(cells[i], "layers")) };
            for (int i = 0; i < result.initial.Length; i++) result.initial[i] = initial[i] == null ? (int?)null : Int(initial[i]);
            for (int i = 0; i < result.palette.Length; i++) result.palette[i] = Int(palette[i]);
            if (result.rulesVersion == "classic-v5") result.obstacles = ReadObstacles(Wire.Required(value, "obstacles"));
            else if (Has(value, "obstacles")) throw new ArgumentException("Invalid gameplay configuration");
            return result;
        }
        private static string StringField(object value, string field)
        {
            object text = Wire.Required(value, field);
            if (!(text is string)) throw new ArgumentException("Invalid text field: " + field);
            return (string)text;
        }
        private static bool? OptionalBoolean(object value, string field)
        {
            if (!Has(value, field)) return null;
            object flag = Get(value, field); if (!(flag is bool)) throw new ArgumentException("Invalid boolean field: " + field);
            return (bool)flag;
        }
        private static int[] IntArray(object value)
        {
            var items = List(value); if (items == null) throw new ArgumentException("Expected integer array");
            var output = new int[items.Count]; for (int i = 0; i < output.Length; i++) output[i] = Int(items[i]); return output;
        }
        private static bool[] BooleanArray(object value)
        {
            var items = List(value); if (items == null) throw new ArgumentException("Expected boolean array");
            var output = new bool[items.Count]; for (int i = 0; i < output.Length; i++) { if (!(items[i] is bool)) throw new ArgumentException("Expected boolean array"); output[i] = (bool)items[i]; } return output;
        }
        private static ObstaclesConfig ReadObstacles(object value)
        {
            var boxes = List(Wire.Required(value, "blockers")); var regions = List(Wire.Required(value, "regions"));
            if (boxes == null || regions == null) throw new ArgumentException("Invalid obstacles");
            var data = new ObstaclesConfig { version = StringField(value, "version"), blockers = new BlockerConfig[boxes.Count], regions = new RegionConfig[regions.Count] };
            if (Has(value, "activation")) data.activation = StringField(value, "activation");
            if (Has(value, "sources")) data.sources = IntArray(Get(value, "sources"));
            for (int b = 0; b < boxes.Count; b++)
            {
                object box = boxes[b];
                data.blockers[b] = new BlockerConfig { id = StringField(box, "id"), cell = Int(Wire.Required(box, "cell")), hp = Int(Wire.Required(box, "hp")), required = OptionalBoolean(box, "required") };
                if (Has(box, "regionId")) data.blockers[b].regionId = StringField(box, "regionId");
            }
            for (int r = 0; r < regions.Count; r++)
            {
                object region = regions[r]; var requirements = List(Wire.Required(region, "requires"));
                if (requirements == null) throw new ArgumentException("Invalid region requirements");
                data.regions[r] = new RegionConfig { id = StringField(region, "id"), cells = IntArray(Wire.Required(region, "cells")), requires = new string[requirements.Count], required = OptionalBoolean(region, "required") };
                for (int i = 0; i < requirements.Count; i++) { if (!(requirements[i] is string)) throw new ArgumentException("Invalid region requirement"); data.regions[r].requires[i] = (string)requirements[i]; }
            }
            return data;
        }
        public static GameSnapshot ReadSnapshot(object value)
        {
            var map = Map(value); var values = List(Get(value, "values")); var layers = List(Get(value, "layers"));
            if (map == null || values == null || layers == null || !(Get(value, "rulesVersion") is string) || !Integer(Get(value, "rngState"), 1, UInt32.MaxValue)) throw new ArgumentException("Invalid match-three checkpoint");
            try {
                var result = new GameSnapshot { version = Int(Get(value, "version")), rulesVersion = (string)Get(value, "rulesVersion"), values = new int?[values.Count], layers = new int[layers.Count], score = Int(Get(value, "score")), movesLeft = Int(Get(value, "movesLeft")), turn = Int(Get(value, "turn")), rngState = (uint)Long(Get(value, "rngState")), history = Route(Get(value, "history")) };
                for (int i = 0; i < values.Count; i++) result.values[i] = values[i] == null ? (int?)null : Int(values[i]);
                for (int i = 0; i < layers.Count; i++) result.layers[i] = Int(layers[i]);
                if (result.version == 5)
                {
                    result.obstacleVersion = StringField(value, "obstacleVersion");
                    result.blockerHp = IntArray(Wire.Required(value, "blockerHp"));
                    result.regionOpen = BooleanArray(Wire.Required(value, "regionOpen"));
                    if (Has(value, "cellOpen")) result.cellOpen = BooleanArray(Get(value, "cellOpen"));
                }
                return result;
            } catch (ArgumentException) { throw new ArgumentException("Invalid match-three checkpoint"); }
        }
        public static Dictionary<string, object> Snapshot(GameSnapshot snapshot)
        {
            var result = new Dictionary<string, object> { { "version", snapshot.version }, { "rulesVersion", snapshot.rulesVersion }, { "values", Clone(snapshot.values) }, { "layers", Clone(snapshot.layers) }, { "score", snapshot.score }, { "movesLeft", snapshot.movesLeft }, { "turn", snapshot.turn }, { "rngState", snapshot.rngState }, { "history", Clone(snapshot.history) } };
            if (snapshot.version == 5)
            {
                result.Add("obstacleVersion", snapshot.obstacleVersion); result.Add("blockerHp", Clone(snapshot.blockerHp)); result.Add("regionOpen", Clone(snapshot.regionOpen));
                if (snapshot.cellOpen != null) result.Add("cellOpen", Clone(snapshot.cellOpen));
            }
            return result;
        }
    }
}
