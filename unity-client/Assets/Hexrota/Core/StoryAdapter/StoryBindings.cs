using System;
using System.Collections.Generic;
using Hexrota.Story;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.StoryAdapter
{
    // A host-level binding gate. The pure reducer intentionally knows no level,
    // material, source, blocker, or region catalog beyond the narrative graph.
    public static class StoryBindings
    {
        private static void Assert(bool value) { if (!value) throw new ArgumentException("Invalid story gameplay binding"); }
        private static object Get(object value, string key) { return W.Get(value, key); }
        private static List<object> Items(object value) { Assert(W.IsList(value)); return W.List(value); }
        public static object Validate(object content, object levels)
        {
            object book = StoryEngine.ValidateContent(content); var byLevel = new Dictionary<int, object>();
            foreach (object level in Items(levels))
            {
                object id = Get(level, "id");
                Assert(W.IsMap(level) && W.IsInteger(id) && W.Number(id) >= 6 && W.Number(id) <= 8 && W.Equal(Get(level, "rulesVersion"), "classic-v6") && W.Equal(Get(level, "levelDataVersion"), "material-alpha-v1") && W.Equal(Get(level, "variantId"), "materials-v1") && !byLevel.ContainsKey(W.Int32(id)));
                byLevel.Add(W.Int32(id), level);
            }
            var nodes = Items(Get(book, "nodes"));
            foreach (object chapter in Items(Get(book, "chapters")))
            {
                object level; Assert(byLevel.TryGetValue(W.Int32(Get(chapter, "levelId")), out level));
                foreach (object node in nodes) if (W.Equal(Get(node, "chapterId"), Get(chapter, "id")))
                {
                    if (Get(node, "trigger") != null) Check(Get(node, "trigger"), level, Get(chapter, "id"), nodes);
                    foreach (object condition in Items(Get(node, "conditions"))) if (W.Equal(Get(condition, "kind"), "event_seen")) Check(W.Obj("event", Get(condition, "event"), "materialId", Get(condition, "materialId"), "subject", Get(condition, "subject")), level, Get(chapter, "id"), nodes);
                }
            }
            return book;
        }
        private static void Check(object filter, object level, object chapterId, List<object> nodes)
        {
            string type = W.String(Get(filter, "event")); object material = Get(filter, "materialId"), subject = Get(filter, "subject");
            var sources = Items(Get(Get(level, "materials"), "sources")); var goals = Items(Get(Get(level, "objectives"), "materials")); var boxes = Items(Get(Get(level, "obstacles"), "blockers")); var regions = Items(Get(Get(level, "obstacles"), "regions"));
            if (type == "material_collected") { Assert(sources.Exists(source => (material == null || W.Equal(Get(source, "materialId"), material)) && (subject == null || W.Equal(Get(source, "id"), subject)))); return; }
            if (type == "material_goal_completed") { Assert(goals.Exists(goal => (material == null || W.Equal(Get(goal, "materialId"), material)) && (subject == null || W.Equal(Get(goal, "materialId"), subject)))); return; }
            Assert(material == null);
            if (type == "blocker_damaged" || type == "blocker_broken") { Assert(boxes.Exists(box => subject == null || W.Equal(Get(box, "id"), subject))); return; }
            if (type == "region_opened") { Assert(regions.Exists(region => subject == null || W.Equal(Get(region, "id"), subject))); return; }
            if (type == "story_choice_selected" || type == "dialogue_acknowledged") { Assert(nodes.Exists(node => W.Equal(Get(node, "chapterId"), chapterId) && (subject == null || W.Equal(Get(node, "id"), subject)) && (type != "story_choice_selected" || Items(Get(node, "choices")).Count > 0))); return; }
            Assert(subject == null);
        }
    }
}
