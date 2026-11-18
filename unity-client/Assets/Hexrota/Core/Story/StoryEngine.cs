using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Hexrota.Contracts;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Story
{
    // Immutable-by-copy narrative transitions. The host supplies canonical facts;
    // this reducer has no gameplay, reward, storage, clock, or rendering service.
    public static class StoryEngine
    {
        public const int EventLimit = 4096, HistoryLimit = 256, QueueLimit = 16, JournalLimit = 512, RepeatLimit = 8;
        private static readonly string[] EventTypes = { "level_started", "valid_match", "blocker_damaged", "blocker_broken", "material_collected", "region_opened", "material_goal_completed", "level_won", "level_lost", "story_choice_selected", "dialogue_acknowledged" };
        public static string[] Types { get { return (string[])EventTypes.Clone(); } }
        private static readonly string[] Poses = { "idle", "point", "call", "celebrate" };
        private const string Error = "invalid_story_contract";
        private sealed class Book
        {
            public Dictionary<string, object> content;
            public readonly Dictionary<string, Dictionary<string, object>> speakers = new Dictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
            public readonly Dictionary<string, Dictionary<string, object>> chapters = new Dictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
            public readonly Dictionary<string, Dictionary<string, object>> nodes = new Dictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
            public readonly List<Dictionary<string, object>> order = new List<Dictionary<string, object>>();
            public readonly Dictionary<string, List<string>> edges = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        }
        private static void Assert(bool test) { if (!test) throw new ArgumentException(Error); }
        private static Dictionary<string, object> Map(object value) { Assert(W.IsMap(value)); return W.Map(value); }
        private static List<object> List(object value) { Assert(W.IsList(value)); return W.List(value); }
        private static object Get(object value, string key) { return W.Get(value, key); }
        private static string Str(object value) { Assert(value is string); return (string)value; }
        private static string Field(object value, string key) { return Str(Get(value, key)); }
        private static bool Integer(object value, int min = 0, int max = int.MaxValue) { return W.IsInteger(value) && W.Number(value) >= min && W.Number(value) <= max; }
        private static int Int(object value) { Assert(Integer(value, int.MinValue)); return W.Int32(value); }
        private static void Keys(object value, params string[] fields)
        {
            var record = Map(value); Assert(record.Count == fields.Length); foreach (string name in fields) Assert(record.ContainsKey(name));
        }
        private static bool Id(object value)
        {
            var text = value as string; if (text == null || text.Length < 1 || text.Length > 64 || text[0] < 'a' || text[0] > 'z') return false;
            foreach (char c in text) if (!(c >= 'a' && c <= 'z') && !(c >= '0' && c <= '9') && c != '-') return false; return true;
        }
        private static bool NullableId(object value) { return value == null || Id(value); }
        private static bool Identity(object value, int max = 16384)
        {
            var text = value as string; if (text == null || text.Length == 0 || text.Length > max) return false;
            foreach (char c in text) if (!(c >= 'a' && c <= 'z') && !(c >= 'A' && c <= 'Z') && !(c >= '0' && c <= '9') && c != ':' && c != '/' && c != '.' && c != '_' && c != '-') return false; return true;
        }
        private static bool JsWhitespace(char c)
        {
            return c == '\u0009' || c == '\u000a' || c == '\u000b' || c == '\u000c' || c == '\u000d' || c == '\u0020' || c == '\u00a0' || c == '\u1680' || (c >= '\u2000' && c <= '\u200a') || c == '\u2028' || c == '\u2029' || c == '\u202f' || c == '\u205f' || c == '\u3000' || c == '\ufeff';
        }
        private static bool Text(object value, int max)
        {
            var text = value as string; if (text == null || text.Length > max) return false; bool nonblank = false;
            foreach (char c in text) { if (!JsWhitespace(c)) nonblank = true; if (c <= '\u0008' || c == '\u000b' || c == '\u000c' || (c >= '\u000e' && c <= '\u001f')) return false; } return nonblank;
        }
        private static bool InternalType(object type) { return W.Equal(type, "story_choice_selected") || W.Equal(type, "dialogue_acknowledged"); }
        private static void Filter(object value)
        {
            Keys(value, "event", "materialId", "subject"); Assert(Array.IndexOf(EventTypes, Get(value, "event") as string) >= 0 && NullableId(Get(value, "materialId")) && NullableId(Get(value, "subject")));
        }
        private static Book Compile(object raw)
        {
            Keys(raw, "schemaVersion", "contentVersion", "speakers", "scenes", "chapters", "nodes"); Assert(W.Equal(Get(raw, "schemaVersion"), 1) && W.Equal(Get(raw, "contentVersion"), "story-content-v1"));
            var speakers = List(Get(raw, "speakers")); var scenes = List(Get(raw, "scenes")); var chapters = List(Get(raw, "chapters")); var nodes = List(Get(raw, "nodes"));
            Assert(speakers.Count > 0 && speakers.Count <= 8 && scenes.Count <= 8 && chapters.Count > 0 && chapters.Count <= 16 && nodes.Count > 0 && nodes.Count <= 128);
            var book = new Book { content = W.Copy(raw) }; var levels = new HashSet<int>(); var orders = new HashSet<string>(StringComparer.Ordinal);
            foreach (object value in speakers)
            {
                Keys(value, "id", "name"); Assert(Id(Get(value, "id")) && Text(Get(value, "name"), 60) && !book.speakers.ContainsKey(Field(value, "id"))); book.speakers.Add(Field(value, "id"), W.Copy(value));
            }
            var sceneIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (object value in scenes)
            {
                Keys(value, "id", "asset"); string asset = Get(value, "asset") as string;
                Assert(Id(Get(value, "id")) && sceneIds.Add(Field(value, "id")) && asset != null && Regex.IsMatch(asset, @"\Aassets/[A-Za-z0-9/_-]+\.(?:webp|png|svg)\z") && !asset.Contains(".."));
            }
            foreach (object value in chapters)
            {
                Keys(value, "id", "levelId"); Assert(Id(Get(value, "id")) && Integer(Get(value, "levelId"), 1, 10000) && !book.chapters.ContainsKey(Field(value, "id")) && levels.Add(Int(Get(value, "levelId")))); book.chapters.Add(Field(value, "id"), W.Copy(value));
            }
            foreach (object value in nodes)
            {
                Keys(value, "id", "chapterId", "speakerId", "text", "pose", "trigger", "conditions", "once", "priority", "order", "next", "choices", "sceneId");
                Assert(Id(Get(value, "id")) && !book.nodes.ContainsKey(Field(value, "id")) && Get(value, "chapterId") is string && book.chapters.ContainsKey(Field(value, "chapterId")) && Get(value, "speakerId") is string && book.speakers.ContainsKey(Field(value, "speakerId")) && Text(Get(value, "text"), 240) && Array.IndexOf(Poses, Get(value, "pose") as string) >= 0 && Get(value, "once") is bool && Integer(Get(value, "priority"), 0, 1000) && Integer(Get(value, "order"), 0, 1000) && NullableId(Get(value, "next")) && NullableId(Get(value, "sceneId")) && (Get(value, "sceneId") == null || sceneIds.Contains(Field(value, "sceneId"))));
                var conditions = List(Get(value, "conditions")); var choices = List(Get(value, "choices")); Assert(conditions.Count <= 16 && choices.Count != 1 && choices.Count <= 4);
                if (Get(value, "trigger") != null) Filter(Get(value, "trigger"));
                Assert(orders.Add(Field(value, "chapterId") + "/" + W.JsString(Get(value, "priority")) + "/" + W.JsString(Get(value, "order"))));
                var choiceIds = new HashSet<string>(StringComparer.Ordinal);
                foreach (object choice in choices) { Keys(choice, "id", "text", "next"); Assert(Id(Get(choice, "id")) && choiceIds.Add(Field(choice, "id")) && Text(Get(choice, "text"), 80) && Id(Get(choice, "next"))); }
                foreach (object condition in conditions)
                {
                    Map(condition); string kind = Field(condition, "kind");
                    if (kind == "event_seen") { Keys(condition, "kind", "event", "materialId", "subject"); Filter(W.Obj("event", Get(condition, "event"), "materialId", Get(condition, "materialId"), "subject", Get(condition, "subject"))); }
                    else if (kind == "node_acknowledged") { Keys(condition, "kind", "nodeId"); Assert(Id(Get(condition, "nodeId"))); }
                    else if (kind == "choice_selected") { Keys(condition, "kind", "nodeId", "choiceId"); Assert(Id(Get(condition, "nodeId")) && Id(Get(condition, "choiceId"))); }
                    else Assert(false);
                }
                var node = W.Copy(value); book.nodes.Add(Field(node, "id"), node); book.order.Add(node);
            }
            foreach (var node in book.order)
            {
                object trigger = Get(node, "trigger");
                if (W.Equal(Get(trigger, "event"), "level_started")) Assert(List(Get(node, "conditions")).Count == 0);
                if (trigger != null && InternalType(Get(trigger, "event")))
                {
                    Dictionary<string, object> source; Assert(Get(trigger, "subject") is string && book.nodes.TryGetValue(Field(trigger, "subject"), out source)); source = book.nodes[Field(trigger, "subject")];
                    Assert(W.Equal(Get(source, "chapterId"), Get(node, "chapterId")) && Get(trigger, "materialId") == null); if (W.Equal(Get(trigger, "event"), "story_choice_selected")) Assert(List(Get(source, "choices")).Count >= 2);
                }
                var branches = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (object condition in List(Get(node, "conditions"))) if (W.Equal(Get(condition, "kind"), "choice_selected"))
                {
                    string referenced = Field(condition, "nodeId"), choice = Field(condition, "choiceId"), previous; Assert(!branches.TryGetValue(referenced, out previous) || previous == choice); branches[referenced] = choice;
                }
                var edges = new List<string>(); if (Get(node, "next") != null) edges.Add(Field(node, "next")); foreach (object choice in List(Get(node, "choices"))) edges.Add(Field(choice, "next"));
                foreach (var candidate in book.order) if (Get(candidate, "trigger") != null && InternalType(Get(Get(candidate, "trigger"), "event")) && W.Equal(Get(Get(candidate, "trigger"), "subject"), Get(node, "id"))) edges.Add(Field(candidate, "id"));
                foreach (string target in edges) { Dictionary<string, object> next; Assert(book.nodes.TryGetValue(target, out next) && W.Equal(Get(next, "chapterId"), Get(node, "chapterId"))); }
                book.edges.Add(Field(node, "id"), edges);
            }
            var visiting = new HashSet<string>(StringComparer.Ordinal); var visited = new HashSet<string>(StringComparer.Ordinal);
            foreach (var node in book.order) Visit(book, Field(node, "id"), visiting, visited);
            foreach (var node in book.order)
            {
                var descendants = new HashSet<string>(StringComparer.Ordinal); foreach (string target in book.edges[Field(node, "id")]) Reach(book, target, descendants);
                foreach (object condition in List(Get(node, "conditions")))
                {
                    if (W.Equal(Get(condition, "kind"), "event_seen"))
                    {
                        if (InternalType(Get(condition, "event")) && Get(condition, "subject") != null)
                        {
                            string eventKey = Field(condition, "subject"); Dictionary<string, object> eventReference;
                            Assert(book.nodes.TryGetValue(eventKey, out eventReference) && W.Equal(Get(eventReference, "chapterId"), Get(node, "chapterId")) && eventKey != Field(node, "id") && !descendants.Contains(eventKey));
                            if (W.Equal(Get(condition, "event"), "story_choice_selected")) Assert(List(Get(eventReference, "choices")).Count >= 2);
                        }
                        continue;
                    }
                    string key = Field(condition, "nodeId"); Dictionary<string, object> referenced;
                    Assert(book.nodes.TryGetValue(key, out referenced) && W.Equal(Get(referenced, "chapterId"), Get(node, "chapterId")) && !W.Equal(Get(referenced, "id"), Get(node, "id")) && !descendants.Contains(key));
                    if (W.Equal(Get(condition, "kind"), "choice_selected")) Assert(List(Get(referenced, "choices")).Exists(c => W.Equal(Get(c, "id"), Get(condition, "choiceId"))));
                }
            }
            var reachable = new HashSet<string>(StringComparer.Ordinal);
            foreach (var node in book.order) if (Get(node, "trigger") != null && !InternalType(Get(Get(node, "trigger"), "event"))) Reach(book, Field(node, "id"), reachable);
            Assert(reachable.Count == book.nodes.Count);
            var dependencies = new Dictionary<string, List<string>>(StringComparer.Ordinal);
            foreach (var entry in book.edges) dependencies.Add(entry.Key, new List<string>(entry.Value));
            foreach (var node in book.order) foreach (object condition in List(Get(node, "conditions")))
            {
                string prerequisite = null;
                if (!W.Equal(Get(condition, "kind"), "event_seen")) prerequisite = Field(condition, "nodeId");
                else if (InternalType(Get(condition, "event")) && Get(condition, "subject") != null) prerequisite = Field(condition, "subject");
                if (prerequisite != null) dependencies[prerequisite].Add(Field(node, "id"));
            }
            var dependencyVisiting = new HashSet<string>(StringComparer.Ordinal); var dependencyVisited = new HashSet<string>(StringComparer.Ordinal);
            foreach (string key in dependencies.Keys) VisitDependencies(dependencies, key, dependencyVisiting, dependencyVisited);
            foreach (var chapter in book.chapters.Values) Assert(book.order.Exists(n => W.Equal(Get(n, "chapterId"), Get(chapter, "id")) && W.Equal(Get(Get(n, "trigger"), "event"), "level_started")));
            return book;
        }
        private static void Visit(Book book, string key, HashSet<string> visiting, HashSet<string> visited)
        {
            Assert(!visiting.Contains(key)); if (visited.Contains(key)) return; visiting.Add(key); foreach (string next in book.edges[key]) Visit(book, next, visiting, visited); visiting.Remove(key); visited.Add(key);
        }
        private static void VisitDependencies(Dictionary<string, List<string>> edges, string key, HashSet<string> visiting, HashSet<string> visited)
        {
            Assert(!visiting.Contains(key)); if (visited.Contains(key)) return; visiting.Add(key); foreach (string next in edges[key]) VisitDependencies(edges, next, visiting, visited); visiting.Remove(key); visited.Add(key);
        }
        private static void Reach(Book book, string key, HashSet<string> reached) { if (!reached.Add(key)) return; foreach (string next in book.edges[key]) Reach(book, next, reached); }
        public static object ValidateContent(object raw) { return W.Clone(Compile(raw).content); }
        private static void ContextCheck(object context, Book book)
        {
            Keys(context, "attemptId", "levelId", "levelDataVersion", "variantId", "chapterId");
            string attempt = Get(context, "attemptId") as string; long serial;
            Assert(attempt != null && attempt.Length <= 120 && attempt.Split('-').Length == 4 && long.TryParse(attempt.Split('-')[2], out serial) && serial <= W.MaxSafeInteger);
            Assert(Integer(Get(context, "levelId"), 1, 10000) && Get(context, "attemptId") is string && Regex.IsMatch(Field(context, "attemptId"), "\\Aa-" + W.JsString(Get(context, "levelId")) + "-[1-9][0-9]*-[0-9a-f]{8}\\z") && Text(Get(context, "levelDataVersion"), 80) && Text(Get(context, "variantId"), 80));
            Dictionary<string, object> chapter; Assert(Get(context, "chapterId") is string && book.chapters.TryGetValue(Field(context, "chapterId"), out chapter) && W.Equal(Get(chapter, "levelId"), Get(context, "levelId")));
        }
        private static Dictionary<string, object> Initial(Book book, object context)
        {
            ContextCheck(context, book); return W.Obj("version", "story-v1", "contentVersion", Get(book.content, "contentVersion"), "context", W.Clone(context), "cursor", 0, "events", W.Arr(), "narrativeEvents", W.Arr(), "fired", W.Arr(), "acknowledged", W.Arr(), "selectedChoices", W.Arr(), "active", null, "pending", W.Arr(), "journal", W.Arr());
        }
        public static object Create(object content, object context) { return Initial(Compile(content), context); }
        private static void EventCheck(object value, bool internalEvent = false)
        {
            Keys(value, "id", "type", "turn", "wave", "subject", "materialId", "quantity", "total", "cell");
            Assert(Identity(Get(value, "id"), internalEvent ? 16384 : 240) && Array.IndexOf(EventTypes, Get(value, "type") as string) >= 0 && Integer(Get(value, "turn"), 0, 10000) && Integer(Get(value, "wave"), 0, 10000) && NullableId(Get(value, "subject")) && NullableId(Get(value, "materialId")) && Integer(Get(value, "quantity")) && Integer(Get(value, "total")) && Integer(Get(value, "cell"), -1, 10000));
            Assert(internalEvent == InternalType(Get(value, "type"))); string type = Field(value, "type");
            if (type == "material_collected") Assert(Get(value, "subject") != null && Get(value, "materialId") != null && Int(Get(value, "quantity")) > 0 && Int(Get(value, "total")) >= Int(Get(value, "quantity")) && Int(Get(value, "cell")) >= 0);
            if (type == "material_goal_completed") Assert(W.Equal(Get(value, "subject"), Get(value, "materialId")) && Get(value, "materialId") != null && Int(Get(value, "quantity")) > 0 && Int(Get(value, "total")) >= Int(Get(value, "quantity")) && Int(Get(value, "cell")) == -1);
            if (type == "valid_match") Assert(Int(Get(value, "quantity")) >= 3 && Get(value, "subject") == null && Get(value, "materialId") == null && Int(Get(value, "total")) == 0 && Int(Get(value, "cell")) == -1);
            if (type == "blocker_damaged" || type == "blocker_broken") Assert(Get(value, "subject") != null && Get(value, "materialId") == null && Int(Get(value, "quantity")) == 1 && Int(Get(value, "cell")) >= 0 && (type != "blocker_broken" || Int(Get(value, "total")) == 0));
            if (type == "level_started" || type == "level_won" || type == "level_lost") Assert(Get(value, "subject") == null && Get(value, "materialId") == null && Int(Get(value, "quantity")) == 0 && Int(Get(value, "total")) == 0 && Int(Get(value, "cell")) == -1);
            if (type == "region_opened" || InternalType(type)) Assert(Get(value, "subject") != null && Get(value, "materialId") == null && Int(Get(value, "quantity")) == 0 && Int(Get(value, "total")) == 0 && Int(Get(value, "cell")) == -1);
        }
        private static void FactsCheck(object value)
        {
            var facts = List(value); Assert(facts.Count <= EventLimit); var ids = new HashSet<string>(StringComparer.Ordinal); int turn = 0, wave = 0; bool terminal = false;
            for (int i = 0; i < facts.Count; i++)
            {
                object fact = facts[i]; EventCheck(fact); int nextTurn = Int(Get(fact, "turn")), nextWave = Int(Get(fact, "wave")); string type = Field(fact, "type");
                Assert(ids.Add(Field(fact, "id")) && !terminal && nextTurn >= turn && (nextTurn != turn || nextWave >= wave));
                if (i == 0) Assert(type == "level_started" && nextTurn == 0 && nextWave == 0);
                else Assert(type != "level_started" && (nextTurn > 0 || type == "level_won" || type == "level_lost") && nextWave > 0);
                turn = nextTurn; wave = nextWave; terminal = type == "level_won" || type == "level_lost";
            }
        }
        private static Book Basic(object content, object value)
        {
            Book book = Compile(content); Keys(value, "version", "contentVersion", "context", "cursor", "events", "narrativeEvents", "fired", "acknowledged", "selectedChoices", "active", "pending", "journal");
            Assert(W.Equal(Get(value, "version"), "story-v1") && W.Equal(Get(value, "contentVersion"), Get(book.content, "contentVersion"))); ContextCheck(Get(value, "context"), book);
            Assert(Integer(Get(value, "cursor"), 0, EventLimit) && Int(Get(value, "cursor")) == List(Get(value, "events")).Count && List(Get(value, "narrativeEvents")).Count <= HistoryLimit && List(Get(value, "fired")).Count <= HistoryLimit && List(Get(value, "acknowledged")).Count <= HistoryLimit && List(Get(value, "selectedChoices")).Count <= HistoryLimit && List(Get(value, "pending")).Count + (Get(value, "active") == null ? 0 : 1) <= QueueLimit && List(Get(value, "journal")).Count <= JournalLimit); return book;
        }
        private static bool Matches(object filter, object fact) { return W.Equal(Get(filter, "event"), Get(fact, "type")) && (Get(filter, "materialId") == null || W.Equal(Get(filter, "materialId"), Get(fact, "materialId"))) && (Get(filter, "subject") == null || W.Equal(Get(filter, "subject"), Get(fact, "subject"))); }
        private static bool Conditions(object node, object state)
        {
            foreach (object condition in List(Get(node, "conditions")))
            {
                string kind = Field(condition, "kind"); bool met;
                if (kind == "event_seen") met = List(Get(state, "events")).Exists(e => Matches(condition, e)) || List(Get(state, "narrativeEvents")).Exists(e => Matches(condition, e));
                else if (kind == "node_acknowledged") met = List(Get(state, "acknowledged")).Exists(a => W.Equal(Get(a, "nodeId"), Get(condition, "nodeId")));
                else met = List(Get(state, "selectedChoices")).Exists(a => W.Equal(Get(a, "nodeId"), Get(condition, "nodeId")) && W.Equal(Get(a, "choiceId"), Get(condition, "choiceId")));
                if (!met) return false;
            }
            return true;
        }
        private static int Compare(Book book, object a, object b)
        {
            var x = book.nodes[Field(a, "nodeId")]; var y = book.nodes[Field(b, "nodeId")]; int priority = Int(Get(y, "priority")) - Int(Get(x, "priority")); if (priority != 0) return priority; int order = Int(Get(x, "order")) - Int(Get(y, "order")); if (order != 0) return order; int node = StringComparer.Ordinal.Compare(Get(a, "nodeId") as string, Get(b, "nodeId") as string); return node != 0 ? node : StringComparer.Ordinal.Compare(Get(a, "instanceId") as string, Get(b, "instanceId") as string);
        }
        private static void Admit(Book book, Dictionary<string, object> state, object node, object fact)
        {
            var fired = List(state["fired"]); var pending = List(state["pending"]); string instance = Field(fact, "id") + "/node/" + Field(node, "id");
            if (fired.Exists(f => W.Equal(Get(f, "instanceId"), instance))) return;
            if (fired.FindAll(f => W.Equal(Get(f, "nodeId"), Get(node, "id"))).Count >= ((bool)Get(node, "once") ? 1 : RepeatLimit) || fired.Count >= HistoryLimit || pending.Count + (state["active"] == null ? 0 : 1) >= QueueLimit) return;
            var item = W.Obj("instanceId", instance, "nodeId", Get(node, "id"), "eventId", Get(fact, "id")); Assert(Identity(instance)); fired.Add(item);
            if (state["active"] == null) state["active"] = W.Clone(item); else { pending.Add(W.Clone(item)); pending.Sort((a, b) => Compare(book, a, b)); }
        }
        private static void Triggers(Book book, Dictionary<string, object> state, object fact)
        {
            var candidates = book.order.FindAll(n => W.Equal(Get(n, "chapterId"), Get(state["context"], "chapterId")) && Get(n, "trigger") != null && Matches(Get(n, "trigger"), fact) && Conditions(n, state));
            candidates.Sort((a, b) => { int priority = Int(Get(b, "priority")) - Int(Get(a, "priority")); return priority != 0 ? priority : Int(Get(a, "order")) - Int(Get(b, "order")); });
            foreach (var node in candidates) Admit(book, state, node, fact);
        }
        private static void Journal(Dictionary<string, object> state, object entry) { var journal = List(state["journal"]); Assert(journal.Count < JournalLimit); journal.Add(entry); }
        public static object Observe(object content, object state, object facts)
        {
            Book book = Basic(content, state); FactsCheck(facts); foreach (object fact in List(facts)) Assert(Field(fact, "id").StartsWith(Field(Get(state, "context"), "attemptId") + "/", StringComparison.Ordinal)); var supplied = List(facts); var consumed = List(Get(state, "events")); int cursor = Int(Get(state, "cursor"));
            for (int i = 0; i < Math.Min(cursor, supplied.Count); i++) Assert(W.Equal(consumed[i], supplied[i])); if (supplied.Count <= cursor) return W.Clone(state);
            var next = W.Copy(state); var events = List(next["events"]);
            for (int i = cursor; i < supplied.Count; i++) { object fact = W.Clone(supplied[i]); events.Add(fact); next["cursor"] = i + 1; Triggers(book, next, fact); }
            var journal = List(next["journal"]); object previous = journal.Count > 0 ? journal[journal.Count - 1] : null;
            if (W.Equal(Get(previous, "kind"), "observe")) Map(previous)["through"] = next["cursor"]; else Journal(next, W.Obj("kind", "observe", "through", next["cursor"])); return next;
        }
        private static object Finish(Book book, Dictionary<string, object> state, object narrative, object next)
        {
            state["active"] = null;
            if (next != null) { var target = book.nodes[Str(next)]; Assert(Conditions(target, state)); Admit(book, state, target, narrative); }
            Triggers(book, state, narrative); var pending = List(state["pending"]);
            if (state["active"] == null && pending.Count > 0) { state["active"] = pending[0]; pending.RemoveAt(0); }
            else if (state["active"] != null && pending.Count > 0) { var items = new List<object> { state["active"] }; items.AddRange(pending); items.Sort((a, b) => Compare(book, a, b)); state["active"] = items[0]; items.RemoveAt(0); state["pending"] = items; }
            return state;
        }
        private static object Action(object content, object state, string instanceId, bool skipped, string choiceId)
        {
            Book book = Basic(content, state); Assert(Identity(instanceId)); var choices = List(Get(state, "selectedChoices")); var acknowledgements = List(Get(state, "acknowledged")); object oldChoice = choices.Find(x => W.Equal(Get(x, "instanceId"), instanceId)), oldAck = acknowledgements.Find(x => W.Equal(Get(x, "instanceId"), instanceId));
            if (choiceId != null) { Assert(Id(choiceId)); if (oldChoice != null) { Assert(W.Equal(Get(oldChoice, "choiceId"), choiceId)); return W.Clone(state); } Assert(oldAck == null); }
            else if (oldAck != null) { Assert(oldChoice == null && W.Equal(Get(oldAck, "skipped"), skipped)); return W.Clone(state); }
            Assert(Get(state, "active") != null && W.Equal(Get(Get(state, "active"), "instanceId"), instanceId)); var node = book.nodes[Field(Get(state, "active"), "nodeId")]; Assert(W.Equal(Get(node, "chapterId"), Get(Get(state, "context"), "chapterId"))); object next = Get(node, "next");
            if (choiceId != null) { object selected = List(Get(node, "choices")).Find(c => W.Equal(Get(c, "id"), choiceId)); Assert(selected != null); next = Get(selected, "next"); } else Assert(List(Get(node, "choices")).Count == 0 || skipped);
            var result = W.Copy(state); var ack = List(result["acknowledged"]); var narrative = List(result["narrativeEvents"]); Assert(ack.Count < HistoryLimit && narrative.Count < HistoryLimit);
            ack.Add(W.Obj("instanceId", instanceId, "nodeId", Get(node, "id"), "skipped", skipped)); if (choiceId != null) List(result["selectedChoices"]).Add(W.Obj("instanceId", instanceId, "nodeId", Get(node, "id"), "choiceId", choiceId));
            var events = List(result["events"]); object last = events.Count == 0 ? null : events[events.Count - 1];
            var fact = W.Obj("id", instanceId + (choiceId == null ? "/ack" : "/choice/" + choiceId), "type", choiceId == null ? "dialogue_acknowledged" : "story_choice_selected", "turn", last == null ? 0 : Get(last, "turn"), "wave", last == null ? 0 : Get(last, "wave"), "subject", Get(node, "id"), "materialId", null, "quantity", 0, "total", 0, "cell", -1);
            EventCheck(fact, true); narrative.Add(fact); Journal(result, choiceId == null ? W.Obj("kind", "ack", "instanceId", instanceId, "skipped", skipped) : W.Obj("kind", "choice", "instanceId", instanceId, "choiceId", choiceId)); return Finish(book, result, fact, next);
        }
        public static object Acknowledge(object content, object state, string instanceId, bool skipped = false) { return Action(content, state, instanceId, skipped, null); }
        public static object Choose(object content, object state, string instanceId, string choiceId) { return Action(content, state, instanceId, false, choiceId); }
        public static object Restore(object content, object raw, object context, object facts)
        {
            Book book = Basic(content, raw); ContextCheck(context, book); Assert(W.Equal(context, Get(raw, "context"))); FactsCheck(facts); foreach (object fact in List(facts)) Assert(Field(fact, "id").StartsWith(Field(context, "attemptId") + "/", StringComparison.Ordinal)); Assert(Int(Get(raw, "cursor")) == List(facts).Count); object state = Initial(book, context);
            foreach (object entry in List(Get(raw, "journal")))
            {
                Map(entry); string kind = Field(entry, "kind");
                if (kind == "observe") { Keys(entry, "kind", "through"); Assert(Integer(Get(entry, "through"), 1, List(facts).Count) && Int(Get(entry, "through")) > Int(Get(state, "cursor"))); state = Observe(content, state, List(facts).GetRange(0, Int(Get(entry, "through")))); }
                else if (kind == "ack") { Keys(entry, "kind", "instanceId", "skipped"); Assert(Get(entry, "skipped") is bool); state = Acknowledge(content, state, Field(entry, "instanceId"), (bool)Get(entry, "skipped")); }
                else if (kind == "choice") { Keys(entry, "kind", "instanceId", "choiceId"); state = Choose(content, state, Field(entry, "instanceId"), Field(entry, "choiceId")); }
                else Assert(false);
            }
            Assert(W.Equal(raw, state)); return state;
        }
        public static object Active(object content, object state)
        {
            Book book = Basic(content, state); if (Get(state, "active") == null) return null; object item = Get(state, "active"); var node = book.nodes[Field(item, "nodeId")]; var choices = new List<object>(); foreach (object choice in List(Get(node, "choices"))) choices.Add(W.Obj("id", Get(choice, "id"), "text", Get(choice, "text")));
            return W.Obj("instanceId", Get(item, "instanceId"), "nodeId", Get(node, "id"), "speakerId", Get(node, "speakerId"), "speakerName", Get(book.speakers[Field(node, "speakerId")], "name"), "text", Get(node, "text"), "pose", Get(node, "pose"), "choices", choices, "sceneId", Get(node, "sceneId"));
        }
        public static object Snapshot(object state) { return W.Clone(state); }
    }
}
