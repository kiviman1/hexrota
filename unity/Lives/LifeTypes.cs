using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;

namespace Hexrota.Lives
{
    public sealed class LifeTypeException : Exception { public LifeTypeException(string message) : base(message) { } }
    public interface IUtcClock { long NowUtcMilliseconds(); }
    public interface IReceiptVerifier { bool Verify(LifeTransaction receipt); }

    // These DTOs retain the existing JSON names and presence, including nullable
    // timestamps and arbitrary archived legacy identities. They do not perform I/O.
    public sealed class LifeConfig
    {
        internal readonly Dictionary<string, object> Data;
        public LifeConfig(Dictionary<string, object> data) { LifeManager.ValidateConfig(data); Data = LifeWire.CopyMap(data); }
        public Dictionary<string, object> ToWire() { return LifeWire.CopyMap(Data); }
        public long MaxLives { get { return LifeWire.Number(Data, "maxLives"); } }
        public long InitialLives { get { return LifeWire.Number(Data, "initialLives"); } }
        public long RefillIntervalMs { get { return LifeWire.Number(Data, "refillIntervalMs"); } }
    }
    public sealed class LifeState
    {
        internal readonly Dictionary<string, object> Data;
        public LifeState(Dictionary<string, object> data) { Data = LifeWire.CopyMap(data); }
        public Dictionary<string, object> ToWire() { return LifeWire.CopyMap(Data); }
        public long Lives { get { return LifeWire.Number(Data, "lives"); } }
        public long LastSeenUtc { get { return LifeWire.Number(Data, "lastSeenUtc"); } }
        public long PendingAdLives { get { return LifeWire.Number(Data, "pendingAdLives"); } }
        public long? RegenAnchorUtc { get { return LifeWire.OptionalInteger(Data, "regenAnchorUtc"); } }
        public long? UnlimitedUntilUtc { get { return LifeWire.OptionalInteger(Data, "unlimitedUntilUtc"); } }
    }
    public sealed class LifeSettlement
    {
        internal readonly Dictionary<string, object> Data;
        public LifeSettlement(Dictionary<string, object> data) { Data = LifeWire.CopyMap(data); }
        public object LevelId { get { return LifeWire.Get(Data, "levelId"); } }
        public string Outcome { get { return LifeWire.Get(Data, "outcome") as string; } }
        public string Waiver { get { return LifeWire.Get(Data, "waiver") as string; } }
        public bool Charged { get { return LifeWire.IsBool(LifeWire.Get(Data, "charged"), true); } }
        public bool Discarded { get { return LifeWire.IsBool(LifeWire.Get(Data, "discarded"), true); } }
        public long MovesUsed { get { return LifeWire.Number(Data, "movesUsed"); } }
        public Dictionary<string, object> ToWire() { return LifeWire.CopyMap(Data); }
    }
    public sealed class LifeTransaction
    {
        internal readonly Dictionary<string, object> Data;
        public LifeTransaction(Dictionary<string, object> data) { Data = LifeWire.CopyMap(data); }
        public string TransactionId { get { return LifeWire.Get(Data, "transactionId") as string; } }
        public string ProductId { get { return LifeWire.Get(Data, "productId") as string; } }
        public string Provider { get { return LifeWire.Get(Data, "provider") as string; } }
        public long? VerifiedAtUtc { get { return LifeWire.OptionalInteger(Data, "verifiedAtUtc"); } }
        public Dictionary<string, object> ToWire() { return LifeWire.CopyMap(Data); }
    }
    public sealed class LifeOperationResult
    {
        public readonly LifeState State;
        public readonly bool Applied;
        public readonly string Reason;
        public readonly bool? Charged;
        internal LifeOperationResult(Dictionary<string, object> state, bool applied, string reason, bool? charged = null)
        { State = new LifeState(state); Applied = applied; Reason = reason; Charged = charged; }
        public Dictionary<string, object> ToWire()
        {
            var wire = LifeWire.Map("state", State.ToWire(), "applied", Applied, "reason", Reason);
            if (Charged.HasValue) wire["charged"] = Charged.Value;
            return wire;
        }
    }
    internal static class LifeWire
    {
        public const long Safe = 9007199254740991L;
        public static readonly object Missing = new object();
        public static object Get(Dictionary<string, object> map, string key)
        { object value; return map != null && map.TryGetValue(key, out value) ? value : Missing; }
        public static Dictionary<string, object> Obj(object value) { return value as Dictionary<string, object>; }
        public static List<object> Array(object value) { return value as List<object>; }
        public static Dictionary<string, object> Map(params object[] values)
        { var result = new Dictionary<string, object>(StringComparer.Ordinal); for (int i = 0; i < values.Length; i += 2) result[(string)values[i]] = values[i + 1]; return result; }
        public static bool Numeric(object value)
        { return value is byte || value is sbyte || value is short || value is ushort || value is int || value is uint || value is long || value is ulong || value is float || value is double || value is decimal; }
        public static bool Integer(object value, long min = 0, long max = Safe)
        {
            if (!Numeric(value)) return false;
            double number = Convert.ToDouble(value, CultureInfo.InvariantCulture);
            return !double.IsNaN(number) && !double.IsInfinity(number) && Math.Truncate(number) == number && number >= min && number <= max;
        }
        public static long N(object value) { return Convert.ToInt64(value, CultureInfo.InvariantCulture); }
        public static long Number(Dictionary<string, object> map, string key) { return N(Get(map, key)); }
        public static long? OptionalInteger(Dictionary<string, object> map, string key) { var value=Get(map,key);return Integer(value)?(long?)N(value):null; }
        public static bool Eq(object a, object b)
        { return Numeric(a) && Numeric(b) ? Convert.ToDouble(a, CultureInfo.InvariantCulture) == Convert.ToDouble(b, CultureInfo.InvariantCulture) : Equals(a, b); }
        public static bool Is(object value, string expected) { return value is string && (string)value == expected; }
        public static bool IsBool(object value, bool expected) { return value is bool && (bool)value == expected; }
        public static object Copy(object value)
        {
            var map = Obj(value); if (map != null) { var copy = new Dictionary<string, object>(StringComparer.Ordinal); foreach (var pair in map) copy[pair.Key] = Copy(pair.Value); return copy; }
            var list = value as IList; if (list != null) { var copy = new List<object>(); foreach (object item in list) copy.Add(Copy(item)); return copy; }
            return value;
        }
        public static Dictionary<string, object> CopyMap(Dictionary<string, object> value)
        { if (value == null) throw new ArgumentException("A JSON object is required"); return (Dictionary<string, object>)Copy(value); }
        public static string String(object value)
        { if (value is string) return (string)value; if (Numeric(value)) return Convert.ToDouble(value, CultureInfo.InvariantCulture).ToString("0", CultureInfo.InvariantCulture); return value == null ? "null" : value.ToString(); }
    }
}
