using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;

namespace Hexrota.Contracts
{
    // JSON-compatible values only. This layer has no JSON, platform, clock or I/O dependency.
    // Presence is represented by dictionary membership: a missing key and an explicit
    // null remain distinct even though Get() conveniently returns null for either.
    public sealed class WireException : ArgumentException
    {
        public string Code { get; private set; }
        public WireException(string code, string message) : base(message) { Code = code; }
    }

    public static class Wire
    {
        public const long MaxSafeInteger = 9007199254740991L;
        private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

        public static void Fail(string code, string message) { throw new WireException(code, message); }
        public static bool IsMap(object value) { return value is IDictionary<string, object>; }
        public static bool IsList(object value) { return value is IList; }
        public static Dictionary<string, object> Map(object value)
        {
            var concrete = value as Dictionary<string, object>;
            if (concrete != null) return concrete;
            var dictionary = value as IDictionary<string, object>;
            if (dictionary != null) return new Dictionary<string, object>(dictionary, StringComparer.Ordinal);
            throw new ArgumentException("Expected a wire object");
        }
        public static List<object> List(object value)
        {
            var concrete = value as List<object>;
            if (concrete != null) return concrete;
            var array = value as IList;
            if (array == null) throw new ArgumentException("Expected a wire array");
            var result = new List<object>(array.Count);
            foreach (object entry in array) result.Add(entry);
            return result;
        }
        public static bool Has(object value, string key)
        {
            var dictionary = value as IDictionary<string, object>;
            return dictionary != null && key != null && dictionary.ContainsKey(key);
        }
        public static object Get(object value, string key, object fallback = null)
        {
            var dictionary = value as IDictionary<string, object>;
            object result;
            return dictionary != null && key != null && dictionary.TryGetValue(key, out result) ? result : fallback;
        }
        public static object Required(object value, string key)
        {
            if (!Has(value, key)) throw new ArgumentException("Missing wire field: " + key);
            return Get(value, key);
        }
        public static Dictionary<string, object> Obj(params object[] pairs)
        {
            if (pairs == null || pairs.Length % 2 != 0) throw new ArgumentException("Wire object requires key/value pairs");
            var result = new Dictionary<string, object>(StringComparer.Ordinal);
            for (int i = 0; i < pairs.Length; i += 2)
            {
                string key = pairs[i] as string;
                if (key == null || result.ContainsKey(key)) throw new ArgumentException("Invalid or duplicate wire key");
                result.Add(key, pairs[i + 1]);
            }
            return result;
        }
        public static List<object> Arr(params object[] values)
        {
            if (values == null) throw new ArgumentException("Wire array requires values");
            return new List<object>(values);
        }
        public static Dictionary<string, object> Copy(object value) { return Map(Clone(value)); }
        public static object Clone(object value)
        {
            if (value == null || value is string || value is bool || IsNumber(value)) return value;
            var dictionary = value as IDictionary<string, object>;
            if (dictionary != null)
            {
                var result = new Dictionary<string, object>(StringComparer.Ordinal);
                foreach (var entry in dictionary) result.Add(entry.Key, Clone(entry.Value));
                return result;
            }
            var array = value as IList;
            if (array != null)
            {
                var result = new List<object>(array.Count);
                foreach (object entry in array) result.Add(Clone(entry));
                return result;
            }
            throw new ArgumentException("Unsupported wire value type: " + value.GetType().FullName);
        }
        public static bool IsNumber(object value)
        {
            return value is byte || value is sbyte || value is short || value is ushort ||
                value is int || value is uint || value is long || value is ulong ||
                value is float || value is double || value is decimal;
        }
        public static double Number(object value)
        {
            if (!IsNumber(value)) throw new ArgumentException("Expected a JSON number without coercion");
            return Convert.ToDouble(value, Invariant);
        }
        public static bool IsInteger(object value)
        {
            if (!IsNumber(value)) return false;
            double number = Number(value);
            return !double.IsNaN(number) && !double.IsInfinity(number) && Math.Truncate(number) == number;
        }
        public static bool IsSafeInteger(object value)
        {
            return IsInteger(value) && Math.Abs(Number(value)) <= MaxSafeInteger;
        }
        public static long Integer(object value, long minimum = -MaxSafeInteger, long maximum = MaxSafeInteger)
        {
            if (!IsSafeInteger(value)) throw new ArgumentException("Expected a safe integer");
            double number = Number(value);
            if (number < minimum || number > maximum) throw new ArgumentException("Integer outside its wire range");
            return (long)number;
        }
        public static int Int32(object value) { return (int)Integer(value, int.MinValue, int.MaxValue); }
        public static uint UInt32(object value) { return (uint)Integer(value, 0, uint.MaxValue); }
        public static string String(object value)
        {
            var text = value as string;
            if (text == null) throw new ArgumentException("Expected a JSON string without coercion");
            return text;
        }
        public static bool Truthy(object value)
        {
            if (value == null) return false;
            if (value is bool) return (bool)value;
            if (value is string) return ((string)value).Length != 0;
            if (IsNumber(value)) { double number = Number(value); return number != 0 && !double.IsNaN(number); }
            return true;
        }
        public static string JsString(object value)
        {
            if (value == null) return "null";
            if (value is string) return (string)value;
            if (value is bool) return (bool)value ? "true" : "false";
            if (IsNumber(value))
            {
                double number = Number(value);
                if (double.IsNaN(number)) return "NaN";
                if (double.IsPositiveInfinity(number)) return "Infinity";
                if (double.IsNegativeInfinity(number)) return "-Infinity";
                if (number == 0) return "0";
                if (IsSafeInteger(value)) return ((long)number).ToString(Invariant);
                return number.ToString("R", Invariant).Replace("E+", "e+").Replace("E-", "e-");
            }
            var list = value as IList;
            if (list != null)
            {
                var parts = new string[list.Count];
                for (int i = 0; i < list.Count; i++) parts[i] = list[i] == null ? "" : JsString(list[i]);
                return string.Join(",", parts);
            }
            return "[object Object]";
        }
        public static string TypeKey(object value)
        {
            if (value is string) return "string:" + (string)value;
            if (IsNumber(value)) return "number:" + JsString(value);
            if (value == null) return "object:null";
            if (value is bool) return "boolean:" + JsString(value);
            return "object:" + JsString(value);
        }
        public static bool Equal(object a, object b)
        {
            if (a == null || b == null) return a == null && b == null;
            if (IsNumber(a) || IsNumber(b)) return IsNumber(a) && IsNumber(b) && Number(a) == Number(b);
            if (a is string || b is string) return a is string && b is string && string.Equals((string)a, (string)b, StringComparison.Ordinal);
            if (a is bool || b is bool) return a is bool && b is bool && (bool)a == (bool)b;
            var leftObject = a as IDictionary<string, object>; var rightObject = b as IDictionary<string, object>;
            if (leftObject != null || rightObject != null)
            {
                if (leftObject == null || rightObject == null || leftObject.Count != rightObject.Count) return false;
                foreach (var entry in leftObject) { object other; if (!rightObject.TryGetValue(entry.Key, out other) || !Equal(entry.Value, other)) return false; }
                return true;
            }
            var leftArray = a as IList; var rightArray = b as IList;
            if (leftArray == null || rightArray == null || leftArray.Count != rightArray.Count) return false;
            for (int i = 0; i < leftArray.Count; i++) if (!Equal(leftArray[i], rightArray[i])) return false;
            return true;
        }
    }
}
