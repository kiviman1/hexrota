using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Hexrota.Application;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    // Native equivalent of dist/playtest.js. Observation is opt-in, bounded and
    // lives outside the game's atomic profile. Only the listed fields are exportable.
    internal sealed class LocalPlaytest
    {
        internal const string Key="hexrota-playtest-v1";
        internal static readonly string[] ContextFields={
            "levelId","variantId","levelDataVersion","attemptId","attemptNumber","movesUsed","movesRemaining",
            "score","targetScore","covered","totalCells","remainingLayers","cascades","hintsUsed","status",
            "reason","previousAttemptId","hintKind","hintGuarantee","developerBypass","lives","requestedLevelId"
        };
        private static readonly string[] Names={"level_started","level_completed","level_failed","level_retried",
            "hint_used","level_abandoned","attempt_resumed","life_blocked"};
        private static readonly string[] MoveFields={"attemptId","turn","pair","cells","scoreBefore","scoreAfter",
            "movesRemaining","coveredBefore","coveredAfter","remainingLayers","waves","matchedIndices","developerBypass"};
        private static readonly string[] Derived={"missingScore","missingGround","failureReason"};
        private readonly IProfileStorage storage;
        private readonly Func<long> utc,monotonic;
        private Dictionary<string,object> state;
        private long last;
        private string active;
        internal bool Enabled {get{return (bool)state["enabled"];}}
        private int Limit {get{return W.Int32(state["limit"]);}}
        private List<object> Events {get{return W.List(state["events"]);}}
        private List<object> Attempts {get{return W.List(state["attempts"]);}}

        internal LocalPlaytest(IProfileStorage store,Func<long> now,Func<long> elapsed)
        {
            storage=store;utc=now;monotonic=elapsed;last=elapsed();
            state=Empty();
            try
            {
                var prior=storage.Read(Key);
                if(prior!=null && ValidState(prior))state=W.Copy(prior);
            }
            catch { /* A damaged observation must never prevent a level from opening. */ }
        }
        private static Dictionary<string,object> Empty(bool enabled=false,int limit=2000)
        {
            return W.Obj("schemaVersion",1,"enabled",enabled,"limit",limit,"overflow",false,"events",W.Arr(),"attempts",W.Arr());
        }
        private static bool Fields(object row,params string[] keys)
        {
            return W.IsMap(row)&&W.Map(row).Keys.All(keys.Contains);
        }
        private static bool Token(object value)
        {
            return value is string s && s!="__proto__" && s!="constructor" && s!="prototype" && Regex.IsMatch(s,@"\A[A-Za-z0-9_.:-]{1,180}\z");
        }
        private static bool Count(object value) { return W.IsSafeInteger(value)&&W.Integer(value)>=0; }
        private static bool ValidStat(string key,object value)
        {
            switch(key)
            {
                case "levelId": case "requestedLevelId": return Count(value)||Token(value);
                case "variantId": case "levelDataVersion": case "attemptId": case "status": case "reason":
                case "previousAttemptId": case "hintKind": case "hintGuarantee": return Token(value);
                case "developerBypass": return value is bool;
                case "failureReason": return new[]{"none","score","ground","score_and_ground"}.Contains(value);
                default: return Count(value);
            }
        }
        private static bool ValidMove(object data)
        {
            if(!Fields(data,MoveFields)||!MoveFields.Where(k=>k!="developerBypass").All(k=>W.Has(data,k)))return false;
            foreach(var kv in W.Map(data))
            {
                if(kv.Key=="pair" || kv.Key=="matchedIndices")
                {
                    if(!W.IsList(kv.Value) || (kv.Key=="pair"&&W.List(kv.Value).Count!=2) || !W.List(kv.Value).All(Count))return false;
                }
                else if(kv.Key=="cells")
                {
                    if(!W.IsList(kv.Value) || W.List(kv.Value).Count!=2 || !W.List(kv.Value).All(c=>
                        Fields(c,"q","r") && W.IsSafeInteger(W.Get(c,"q")) && W.IsSafeInteger(W.Get(c,"r"))))return false;
                }
                else if(!ValidStat(kv.Key,kv.Value))return false;
            }
            return true;
        }
        private static bool ValidState(object raw)
        {
            if(!Fields(raw,"schemaVersion","enabled","limit","overflow","events","attempts")||!W.Equal(W.Get(raw,"schemaVersion"),1)||
                !(W.Get(raw,"enabled") is bool)||!(W.Get(raw,"overflow") is bool)||!Count(W.Get(raw,"limit")))return false;
            int limit=W.Int32(W.Get(raw,"limit"));
            if(limit<10||limit>10000 || !W.IsList(W.Get(raw,"events")) || !W.IsList(W.Get(raw,"attempts")))return false;
            var events=W.List(W.Get(raw,"events"));var attempts=W.List(W.Get(raw,"attempts"));
            if(events.Count>limit||attempts.Count>limit || !attempts.All(a=>Fields(a,"attemptId","observedStart","activeMs") &&
                Token(W.Get(a,"attemptId")) && W.Get(a,"observedStart") is bool && Count(W.Get(a,"activeMs"))))return false;
            foreach(var e in events)
            {
                if(!Fields(e,"name","utcMs","data")||!Count(W.Get(e,"utcMs")))return false;
                var name=W.Get(e,"name") as string;object data=W.Get(e,"data");
                if(name=="move"){if(!ValidMove(data))return false;}
                else if(!Names.Contains(name)||!Fields(data,ContextFields.Concat(Derived).ToArray())||!W.Map(data).All(p=>ValidStat(p.Key,p.Value)))return false;
            }
            return true;
        }
        private Dictionary<string,object> Attempt(string id)
        {
            if(id==null)return null;
            var found=Attempts.FirstOrDefault(a=>W.Equal(W.Get(a,"attemptId"),id));
            if(found!=null)return W.Map(found);
            if(Attempts.Count>=Limit){state["overflow"]=true;return null;}
            var row=W.Obj("attemptId",id,"activeMs",0,"observedStart",false);Attempts.Add(row);return row;
        }
        private void Flush()
        {
            long now=Math.Max(monotonic(),last);
            if(Enabled&&active!=null)
            {
                var entry=Attempt(active);
                if(entry!=null)entry["activeMs"]=W.Integer(entry["activeMs"])+(now-last);
            }
            last=now;
        }
        internal void Activity(string id)
        {
            if(active==id)return;
            Flush();active=id;
            if(id==null)Save();
        }
        internal void SetEnabled(bool value)
        {
            Flush();active=null;state["enabled"]=value;Save();
        }
        internal void Clear(bool disable=false)
        {
            state=Empty(!disable&&Enabled,Limit);last=monotonic();active=null;Save();
        }
        internal void Save()
        {
            Flush();
            try
            {
                if(storage is FileProfileStorage files)files.WriteObservation(Key,state);
                else storage.Write(Key,state);
            }
            catch { /* Observations cannot roll back committed gameplay. */ }
        }
        private void Add(string name,object data,long timestamp)
        {
            if(Events.Count>=Limit){state["overflow"]=true;return;}
            Events.Add(W.Obj("name",name,"utcMs",timestamp,"data",data));
        }
        internal void Event(string name,object context,bool bypass)
        {
            if(!Enabled||!Names.Contains(name))return;
            var fields=W.Obj("developerBypass",bypass);
            foreach(var key in ContextFields)if(W.Has(context,key))fields[key]=W.Clone(W.Get(context,key));
            var entry=Attempt(W.Get(fields,"attemptId") as string);
            if(entry!=null && name=="level_started")entry["observedStart"]=true;
            if(name=="level_completed"||name=="level_failed")
            {
                long score=Math.Max(0,W.Integer(fields["targetScore"])-W.Integer(fields["score"]));
                long ground=Math.Max(0,W.Integer(fields["totalCells"])-W.Integer(fields["covered"]));
                fields["missingScore"]=score;fields["missingGround"]=ground;
                fields["failureReason"]=name=="level_completed"?"none":score>0?(ground>0?"score_and_ground":"score"):"ground";
            }
            Add(name,fields,W.Integer(W.Get(context,"timestamp",utc())));
        }
        internal void Move(Dictionary<string,object> data) { if(Enabled&&ValidMove(data))Add("move",data,utc()); }
        internal Dictionary<string,object> Export()
        {
            Flush();
            var result=W.Copy(state);result["exportedAtUtc"]=utc();result["scope"]="local_opt_in_no_personal_data";
            result["activeTimeDefinition"]="Focused playing game, excluding animations, dialogs and background; monotonic per session.";
            result["limitations"]=W.Arr("No global player identity or server upload.","Imported/resumed starts may be unobserved.","Overflow indicates an incomplete observation window.");
            return result;
        }
    }
}
