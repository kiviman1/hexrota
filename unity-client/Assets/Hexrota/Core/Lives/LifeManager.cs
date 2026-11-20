using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

namespace Hexrota.Lives
{
    // Pure lives-v2 reducers. UTC and receipt trust are injected capabilities.
    public sealed class LifeManager
    {
        public const int SchemaVersion = 2;
        public const string RulesVersion = "lives-v2";
        public const long DayMilliseconds = 86400000L;
        public const int TechnicalRichRetention = 128;
        private static readonly string[] Products = { "ad_life", "single_life", "refill_lives", "unlimited_lives_30m" };
        private static readonly HashSet<string> Reserved = new HashSet<string>(new[] { "__proto__", "constructor", "prototype", "toString", "toLocaleString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__" }, StringComparer.Ordinal);
        private static readonly HashSet<string> Waivers = new HashSet<string>(new[] { "tutorial", "won", "no_moves", "unlimited", "developer_bypass", "first_failure", "empty", "historical" }, StringComparer.Ordinal);
        private readonly Dictionary<string, object> config;
        private readonly IUtcClock clock;
        private readonly IReceiptVerifier verifier;
        public LifeConfig Config { get { return new LifeConfig(config); } }
        public LifeManager(LifeConfig configuration, IUtcClock clock, IReceiptVerifier verifier = null)
        { if (configuration == null) Fail("Invalid life configuration"); if (clock == null) Fail("LifeManager requires an injected UTC clock"); config = configuration.ToWire(); this.clock = clock; this.verifier = verifier; }
        public LifeManager(Dictionary<string, object> configuration, IUtcClock clock, IReceiptVerifier verifier = null) : this(new LifeConfig(configuration), clock, verifier) { }
        private static object G(Dictionary<string, object> map, string key) { return LifeWire.Get(map, key); }
        private static Dictionary<string, object> O(object value) { return LifeWire.Obj(value); }
        private static List<object> A(object value) { return LifeWire.Array(value); }
        private static Dictionary<string, object> M(params object[] values) { return LifeWire.Map(values); }
        private static long N(Dictionary<string, object> map, string key) { return LifeWire.Number(map, key); }
        private static bool I(object value, long min = 0, long max = LifeWire.Safe) { return LifeWire.Integer(value, min, max); }
        private static bool S(object value, string expected) { return LifeWire.Is(value, expected); }
        private static bool B(object value, bool expected = true) { return LifeWire.IsBool(value, expected); }
        private static bool E(object a, object b) { return LifeWire.Eq(a, b); }
        private static void Fail(string message) { throw new ArgumentException(message); }
        private static bool Token(object value) { return value is string && Regex.IsMatch((string)value, @"\A[A-Za-z0-9_.:-]{1,180}\z", RegexOptions.CultureInvariant) && !Reserved.Contains((string)value); }
        private static bool Id(object value) { return Token(value) || I(value); }
        private static bool NullableTime(object value) { return value == null || I(value); }
        private static string LevelKey(object value) { return (value is string ? "string:" : "number:") + LifeWire.String(value); }
        private static bool Includes(IEnumerable<object> list, object item) { return list.Any(value => E(value, item)); }
        private long Now() { long time = clock.NowUtcMilliseconds(); if (!I(time)) Fail("Clock must return UTC milliseconds as a safe non-negative integer"); return time; }
        private static Dictionary<string, object> Ledger(Dictionary<string, object> state, string field) { return O(G(state, field)); }
        private static List<object> ArchiveSettlement(Dictionary<string, object> row) { return new List<object> { G(row,"levelId"),G(row,"tutorial"),G(row,"outcome"),G(row,"movesUsed"),G(row,"settledAtUtc"),G(row,"charged"),G(row,"waiver"),G(row,"discardedAtUtc") }; }
        private static Dictionary<string, object> ExpandSettlement(List<object> row) { return M("levelId",row[0],"tutorial",row[1],"outcome",row[2],"movesUsed",row[3],"settledAtUtc",row[4],"charged",row[5],"waiver",row[6],"discarded",row[7]!=null,"discardedAtUtc",row[7]); }
        private static List<object> ArchiveTransaction(Dictionary<string, object> row) { return new List<object> { G(row,"productId"),G(row,"provider"),G(row,"verifiedAtUtc"),G(row,"processedAtUtc"),G(row,"result"),G(row,"reason") }; }
        private static Dictionary<string, object> ExpandTransaction(List<object> row) { return M("productId",row[0],"provider",row[1],"verifiedAtUtc",row[2],"processedAtUtc",row[3],"result",row[4],"reason",row[5]); }
        private static bool InRanges(List<object> ranges, long value) { return ranges.Any(item => { var range=A(item); return value>=LifeWire.N(range[0]) && value<=LifeWire.N(range[1]); }); }
        private static bool ValidRanges(object value)
        {
            var ranges=A(value); if(ranges==null)return false;long previous=0;
            foreach(var item in ranges){var pair=A(item);if(pair==null||pair.Count!=2||!I(pair[0],1)||!I(pair[1],LifeWire.N(pair[0]))||LifeWire.N(pair[0])<=previous)return false;previous=LifeWire.N(pair[1])+1;}return true;
        }
        private static List<object> AddRange(List<object> ranges,long value)
        {
            var ordered=ranges.Select(item=>new List<object>(A(item))).ToList();ordered.Add(new List<object>{value,value});ordered.Sort((a,b)=>LifeWire.N(a[0]).CompareTo(LifeWire.N(b[0])));var merged=new List<object>();
            foreach(var pair in ordered){var last=merged.Count==0?null:A(merged[merged.Count-1]);if(last!=null&&LifeWire.N(pair[0])<=LifeWire.N(last[1])+1)last[1]=Math.Max(LifeWire.N(last[1]),LifeWire.N(pair[1]));else merged.Add(pair);}return merged;
        }
        public static bool ValidateConfig(Dictionary<string, object> c)
        {
            if(c==null||!(E(G(c,"schemaVersion"),1)&&S(G(c,"rulesVersion"),"lives-v1")||E(G(c,"schemaVersion"),2)&&S(G(c,"rulesVersion"),"lives-v2"))||!E(G(c,"maxLives"),5)||!E(G(c,"initialLives"),5)||!I(G(c,"refillIntervalMs"),1)||!I(G(c,"maxLedgerEntries"),1,1000000))Fail("Invalid life configuration");
            var protection=O(G(c,"firstFailureProtection"));if(protection==null||!(G(protection,"enabled")is bool)||A(G(protection,"levelIds"))==null||A(G(protection,"levelIds")).Any(value=>!Id(value)))Fail("Invalid first-failure protection");
            var ads=O(G(c,"ads"));if(ads==null||!I(G(ads,"rewardLives"),1,5)||!I(G(ads,"dailyLimit"),1,100)||!I(G(ads,"cooldownMs"),1))Fail("Invalid life advertisement rules");
            var products=O(G(c,"products"));if(products==null||O(G(products,"single_life"))==null||O(G(products,"refill_lives"))==null||O(G(products,"unlimited_lives_30m"))==null||!I(G(O(G(products,"single_life")),"amount"),1,5)||!I(G(O(G(products,"unlimited_lives_30m")),"durationMs"),1))Fail("Invalid life products");
            foreach(string name in Products.Where(name=>name!="ad_life"))if(!I(G(O(G(products,name)),"costGold"),0,2147483647))Fail("Invalid test Gold price");
            var development=O(G(c,"development"));if(development==null||!(G(development,"allowBypass")is bool)||!I(G(development,"initialTestGold"),0,2147483647))Fail("Invalid life development rules");return true;
        }
        private static void CheckSettlement(string attemptId, Dictionary<string, object> r,long time)
        {
            if(!Token(attemptId)||r==null||!Id(G(r,"levelId"))||!(G(r,"tutorial")is bool)||!new[]{"failed","won","restart"}.Any(x=>S(G(r,"outcome"),x))||!I(G(r,"movesUsed"))||!I(G(r,"settledAtUtc"))||N(r,"settledAtUtc")>time||!(G(r,"charged")is bool)||!(G(r,"discarded")is bool)||!NullableTime(G(r,"discardedAtUtc"))||B(G(r,"discarded"))!=(G(r,"discardedAtUtc")!=null)||G(r,"discardedAtUtc")!=null&&LifeWire.N(G(r,"discardedAtUtc"))>time||!(G(r,"waiver")==null||G(r,"waiver")is string&&Waivers.Contains((string)G(r,"waiver"))))Fail("Invalid attempt life settlement");
            if(B(G(r,"charged"))&&G(r,"waiver")!=null||S(G(r,"outcome"),"restart")&&!B(G(r,"discarded")))Fail("Inconsistent life settlement");
        }
        private static void CheckTransaction(string transactionId,Dictionary<string,object> r,long time)
        {if(!Token(transactionId)||r==null||!Products.Any(x=>S(G(r,"productId"),x))||!Token(G(r,"provider"))||!I(G(r,"verifiedAtUtc"))||!I(G(r,"processedAtUtc"))||N(r,"verifiedAtUtc")>N(r,"processedAtUtc")||N(r,"processedAtUtc")>time||!new[]{"granted","rejected"}.Any(x=>S(G(r,"result"),x))||!Token(G(r,"reason")))Fail("Invalid processed life transaction");}
        public bool ValidateState(LifeState state) { return ValidateState(state==null?null:state.ToWire()); }
        public bool ValidateState(Dictionary<string,object> state)
        {
            bool legacy=E(G(state,"schemaVersion"),1)&&S(G(state,"rulesVersion"),"lives-v1");
            if(state==null||!legacy&&!(E(G(state,"schemaVersion"),SchemaVersion)&&S(G(state,"rulesVersion"),RulesVersion))||!I(G(state,"lives"),0,N(config,"maxLives"))||!I(G(state,"lastSeenUtc"))||!NullableTime(G(state,"regenAnchorUtc"))||!NullableTime(G(state,"unlimitedUntilUtc"))||!(G(state,"developerBypass")is bool))Fail("Invalid life save");
            if(N(state,"lives")==N(config,"maxLives")?G(state,"regenAnchorUtc")!=null:G(state,"regenAnchorUtc")==null||LifeWire.N(G(state,"regenAnchorUtc"))>N(state,"lastSeenUtc"))Fail("Invalid life refill anchor");
            foreach(string field in new[]{"settledAttempts","processedTransactions","protectionUsed","firstFailures"})if(Ledger(state,field)==null)Fail("Invalid life ledger");
            foreach(var row in Ledger(state,"settledAttempts"))CheckSettlement(row.Key,O(row.Value),N(state,"lastSeenUtc"));
            foreach(var row in Ledger(state,"processedTransactions"))CheckTransaction(row.Key,O(row.Value),N(state,"lastSeenUtc"));
            if(!legacy){
                if(!I(G(state,"pendingAdLives")))Fail("Invalid pending life credit");
                foreach(string field in new[]{"registeredAttempts","settledArchive","transactionArchive","transactionStreams"})if(Ledger(state,field)==null)Fail("Invalid compact life ledger");
                foreach(var row in Ledger(state,"registeredAttempts")){var r=O(row.Value);if(!Token(row.Key)||r==null||!Id(G(r,"levelId"))||!(G(r,"tutorial")is bool)||!I(G(r,"startedAtUtc"))||N(r,"startedAtUtc")>N(state,"lastSeenUtc")||!(G(r,"unlimitedAtStart")is bool)||r.ContainsKey("reserved")&&!(G(r,"reserved")is bool)||Ledger(state,"settledAttempts").ContainsKey(row.Key)||Ledger(state,"settledArchive").ContainsKey(row.Key))Fail("Invalid registered attempt");}
                foreach(var row in Ledger(state,"settledArchive")){var entry=A(row.Value);if(entry==null||entry.Count!=8||Ledger(state,"settledAttempts").ContainsKey(row.Key))Fail("Invalid compact settlement");CheckSettlement(row.Key,ExpandSettlement(entry),N(state,"lastSeenUtc"));}
                foreach(var row in Ledger(state,"transactionArchive")){var entry=A(row.Value);if(entry==null||entry.Count!=6||Ledger(state,"processedTransactions").ContainsKey(row.Key))Fail("Invalid compact transaction");CheckTransaction(row.Key,ExpandTransaction(entry),N(state,"lastSeenUtc"));}
                foreach(var row in Ledger(state,"transactionStreams")){var stream=O(row.Value);if(!Token(row.Key)||stream==null||!Token(G(stream,"provider"))||!ValidRanges(G(stream,"ranges")))Fail("Invalid verified transaction stream");}
                foreach(var row in Ledger(state,"processedTransactions")){var r=O(row.Value);if((r.ContainsKey("streamId")||r.ContainsKey("sequence"))&&(!Token(G(r,"streamId"))||!I(G(r,"sequence"),1)||row.Key!=LifeWire.String(G(r,"streamId"))+"-"+LifeWire.String(G(r,"sequence"))||!Ledger(state,"transactionStreams").ContainsKey(LifeWire.String(G(r,"streamId")))||!E(G(O(G(Ledger(state,"transactionStreams"),LifeWire.String(G(r,"streamId")))),"provider"),G(r,"provider"))||!InRanges(A(G(O(G(Ledger(state,"transactionStreams"),LifeWire.String(G(r,"streamId")))),"ranges")),N(r,"sequence"))))Fail("Invalid streamed transaction");}
            }
            foreach(var row in Ledger(state,"protectionUsed"))if(!Regex.IsMatch(row.Key,"^(number|string):")||!B(row.Value))Fail("Invalid protection ledger");
            foreach(var row in Ledger(state,"firstFailures"))if(!Regex.IsMatch(row.Key,"^(number|string):")||!Token(row.Value))Fail("Invalid first-failure ledger");
            var ad=O(G(state,"adUsage"));if(ad==null||!I(G(ad,"dayUtc"))||N(ad,"dayUtc")>N(state,"lastSeenUtc")/DayMilliseconds||!I(G(ad,"claims"),0,N(O(G(config,"ads")),"dailyLimit"))||!NullableTime(G(ad,"lastClaimUtc"))||G(ad,"lastClaimUtc")!=null&&LifeWire.N(G(ad,"lastClaimUtc"))>N(state,"lastSeenUtc"))Fail("Invalid advertisement cooldown");return true;
        }
        public LifeState CreateState()
        {
            long time=Now();return new LifeState(M("schemaVersion",SchemaVersion,"rulesVersion",RulesVersion,"lives",N(config,"initialLives"),"regenAnchorUtc",null,"lastSeenUtc",time,"unlimitedUntilUtc",null,"developerBypass",false,"registeredAttempts",M(),"pendingAdLives",0L,"settledAttempts",M(),"settledArchive",M(),"processedTransactions",M(),"transactionArchive",M(),"transactionStreams",M(),"protectionUsed",M(),"firstFailures",M(),"adUsage",M("dayUtc",time/DayMilliseconds,"claims",0L,"lastClaimUtc",null)));
        }
        private Dictionary<string,object> Migrate(Dictionary<string,object> raw)
        {
            ValidateState(raw);var state=LifeWire.CopyMap(raw);if(E(G(state,"schemaVersion"),1)){state["schemaVersion"]=SchemaVersion;state["rulesVersion"]=RulesVersion;state["registeredAttempts"]=M();state["pendingAdLives"]=0L;state["settledArchive"]=M();state["transactionArchive"]=M();state["transactionStreams"]=M();}return state;
        }
        private sealed class RichRow { public string Kind; public string Key; public long Time; }
        private Dictionary<string,object> Compact(Dictionary<string,object> state)
        {
            var rows=Ledger(state,"settledAttempts").Select(row=>new RichRow{Kind="attempt",Key=row.Key,Time=N(O(row.Value),"settledAtUtc")}).Concat(Ledger(state,"processedTransactions").Select(row=>new RichRow{Kind="transaction",Key=row.Key,Time=N(O(row.Value),"processedAtUtc")})).OrderBy(row=>row.Time).ThenBy(row=>row.Key,StringComparer.Ordinal).ToList();
            int remove=Math.Max(0,rows.Count-(int)Math.Min(N(config,"maxLedgerEntries"),TechnicalRichRetention));
            foreach(var row in rows.Take(remove)){if(row.Kind=="attempt"){Ledger(state,"settledArchive")[row.Key]=ArchiveSettlement(O(G(Ledger(state,"settledAttempts"),row.Key)));Ledger(state,"settledAttempts").Remove(row.Key);}else{var record=O(G(Ledger(state,"processedTransactions"),row.Key));if(!record.ContainsKey("streamId"))Ledger(state,"transactionArchive")[row.Key]=ArchiveTransaction(record);Ledger(state,"processedTransactions").Remove(row.Key);}}return state;
        }
        private void Reserve(Dictionary<string,object> state)
        {if(N(state,"lives")==N(config,"maxLives"))state["regenAnchorUtc"]=N(state,"lastSeenUtc");state["lives"]=N(state,"lives")-1;}
        /// <summary>Gives back the life reserved for an attempt left before its first move; the attempt stays open.</summary>
        public LifeOperationResult ReleaseReservation(LifeState raw,object attemptId)
        {
            var state=Reconcile(raw).ToWire();var row=Token(attemptId)?O(G(Ledger(state,"registeredAttempts"),(string)attemptId)):null;
            if(row==null||!B(G(row,"reserved")))return new LifeOperationResult(state,false,"not_reserved");
            row["reserved"]=false;Refund(state);return new LifeOperationResult(state,true,"released");
        }
        private void Refund(Dictionary<string,object> state)
        {state["lives"]=Math.Min(N(config,"maxLives"),N(state,"lives")+1);if(N(state,"lives")==N(config,"maxLives"))state["regenAnchorUtc"]=null;}
        private void ApplyPending(Dictionary<string,object> state)
        {long gain=Math.Min(N(config,"maxLives")-N(state,"lives"),N(state,"pendingAdLives"));state["lives"]=N(state,"lives")+gain;state["pendingAdLives"]=N(state,"pendingAdLives")-gain;if(N(state,"lives")==N(config,"maxLives"))state["regenAnchorUtc"]=null;}
        private Dictionary<string,object> ReconcileAt(Dictionary<string,object> raw,long observedNow)
        {
            var state=Migrate(raw);long time=Math.Max(observedNow,N(state,"lastSeenUtc"));state["lastSeenUtc"]=time;
            if(N(state,"lives")<N(config,"maxLives")){long ticks=(time-N(state,"regenAnchorUtc"))/N(config,"refillIntervalMs"),gain=Math.Min(N(config,"maxLives")-N(state,"lives"),ticks);state["lives"]=N(state,"lives")+gain;if(N(state,"lives")==N(config,"maxLives"))state["regenAnchorUtc"]=null;else state["regenAnchorUtc"]=N(state,"regenAnchorUtc")+gain*N(config,"refillIntervalMs");}
            ApplyPending(state);if(G(state,"unlimitedUntilUtc")!=null&&N(state,"unlimitedUntilUtc")<=time)state["unlimitedUntilUtc"]=null;
            long day=time/DayMilliseconds;var ad=Ledger(state,"adUsage");if(day>N(ad,"dayUtc")){ad["dayUtc"]=day;ad["claims"]=0L;}return Compact(state);
        }
        public LifeState Reconcile(LifeState raw) { long observed=Now();return new LifeState(ReconcileAt(raw==null?null:raw.ToWire(),observed)); }
        public LifeState Restore(Dictionary<string,object> raw) { return raw==null?CreateState():new LifeState(ReconcileAt(raw,Now())); }
        private bool Unlimited(Dictionary<string,object> state) { return G(state,"unlimitedUntilUtc")!=null&&N(state,"unlimitedUntilUtc")>N(state,"lastSeenUtc"); }
        private bool Bypass(Dictionary<string,object> state) { return B(G(O(G(config,"development")),"allowBypass"))&&B(G(state,"developerBypass")); }
        private static Dictionary<string,object> Settlement(Dictionary<string,object> state,string attemptId)
        {return Ledger(state,"settledAttempts").ContainsKey(attemptId)?O(G(Ledger(state,"settledAttempts"),attemptId)):Ledger(state,"settledArchive").ContainsKey(attemptId)?ExpandSettlement(A(G(Ledger(state,"settledArchive"),attemptId))):null;}
        public LifeSettlement SettlementFor(LifeState raw,object attemptId) { var state=Reconcile(raw).ToWire();var record=Token(attemptId)?Settlement(state,(string)attemptId):null;return record==null?null:new LifeSettlement(record); }
        public Dictionary<string,object> RegisteredAttemptFor(LifeState raw,object attemptId) { var state=Reconcile(raw).ToWire();return Token(attemptId)&&Ledger(state,"registeredAttempts").ContainsKey((string)attemptId)?LifeWire.CopyMap(O(G(Ledger(state,"registeredAttempts"),(string)attemptId))):null; }
        public bool CanResume(LifeState raw,object attemptId) { var state=Reconcile(raw).ToWire();return Token(attemptId)&&!B(G(Settlement(state,(string)attemptId),"discarded")); }
        private bool CanStartReconciled(Dictionary<string,object> state,Dictionary<string,object> context)
        {if(B(G(context,"tutorial")))return true;if(B(G(context,"resume")))return Token(G(context,"attemptId"))&&!B(G(Settlement(state,(string)G(context,"attemptId")),"discarded"));return Bypass(state)||Unlimited(state)||N(state,"lives")>0;}
        public bool CanStart(LifeState raw) { return CanStartReconciled(Reconcile(raw).ToWire(),M()); }
        public bool CanStart(LifeState raw,object context) { var state=Reconcile(raw).ToWire();if(context==null)throw new LifeTypeException("Cannot read properties of null (reading 'tutorial')");return CanStartReconciled(state,O(context)??M()); }
        public LifeOperationResult RegisterAttempt(LifeState raw,Dictionary<string,object> context)
        {
            if(context==null||!Token(G(context,"attemptId"))||!Id(G(context,"levelId"))||!(G(context,"tutorial")is bool))Fail("Invalid life attempt registration");var state=Reconcile(raw).ToWire();string attemptId=(string)G(context,"attemptId");var registered=Ledger(state,"registeredAttempts");var old=registered.ContainsKey(attemptId)?O(G(registered,attemptId)):Settlement(state,attemptId);
            if(old!=null){if(!E(G(old,"levelId"),G(context,"levelId"))||!E(G(old,"tutorial"),G(context,"tutorial")))return new LifeOperationResult(state,false,"attempt_identity_mismatch");
                // An untouched attempt whose life was released on leaving reserves one again when it is resumed.
                if(registered.ContainsKey(attemptId)&&B(G(context,"resume"))&&G(old,"reserved")is bool&&!B(G(old,"reserved"))&&!B(G(old,"tutorial"))&&!Bypass(state)&&!Unlimited(state)&&N(state,"lives")>0){Reserve(state);old["reserved"]=true;return new LifeOperationResult(state,true,"reserved");}
                return new LifeOperationResult(state,false,registered.ContainsKey(attemptId)?"already_registered":"already_settled");}
            if(!CanStartReconciled(state,context))return new LifeOperationResult(state,false,"no_lives");
            // A life is reserved when a chapter starts. A win gives it back; a loss, a restart or leaving keeps it spent.
            bool reserve=!B(G(context,"tutorial"))&&!Bypass(state)&&!Unlimited(state)&&N(state,"lives")>0;if(reserve)Reserve(state);
            registered[attemptId]=M("levelId",G(context,"levelId"),"tutorial",G(context,"tutorial"),"startedAtUtc",N(state,"lastSeenUtc"),"unlimitedAtStart",Unlimited(state),"reserved",reserve);return new LifeOperationResult(state,true,"registered");
        }
        private Dictionary<string,object> Availability(Dictionary<string,object> state,object productId,bool completed=false)
        {
            long time=N(state,"lastSeenUtc");var products=O(G(config,"products"));object cost=S(productId,"ad_life")?0L:G(O(productId is string?G(products,(string)productId):null),"costGold");
            if(!Products.Any(x=>S(productId,x)))return M("allowed",false,"reason","unknown_product","costGold",0L,"availableAtUtc",null,"waitMs",null);
            if(!S(productId,"unlimited_lives_30m")&&N(state,"lives")==N(config,"maxLives")&&!(completed&&S(productId,"ad_life")))return M("allowed",false,"reason","already_full","costGold",cost,"availableAtUtc",null,"waitMs",null);
            if(S(productId,"ad_life")){var ad=Ledger(state,"adUsage");var rules=O(G(config,"ads"));double cooldown=G(ad,"lastClaimUtc")==null?time:(double)N(ad,"lastClaimUtc")+N(rules,"cooldownMs"),quota=N(ad,"claims")>=N(rules,"dailyLimit")?((double)N(ad,"dayUtc")+1)*DayMilliseconds:time,available=Math.Max(cooldown,quota);if(available>time)return M("allowed",false,"reason",quota>time?"ad_daily_limit":"ad_cooldown","costGold",cost,"availableAtUtc",available,"waitMs",available-time);}
            return M("allowed",true,"reason","available","costGold",cost,"availableAtUtc",time,"waitMs",0L);
        }
        public Dictionary<string,object> TransactionAvailability(LifeState raw,object productId) { return Availability(Reconcile(raw).ToWire(),productId); }
        public Dictionary<string,object> View(LifeState raw)
        {
            long observed=Now();var state=ReconcileAt(raw==null?null:raw.ToWire(),observed);long time=N(state,"lastSeenUtc");object next=G(state,"regenAnchorUtc")==null?null:(object)((double)N(state,"regenAnchorUtc")+N(config,"refillIntervalMs"));var ad=Availability(state,"ad_life");object until=G(state,"unlimitedUntilUtc");
            return M("lives",N(state,"lives"),"maxLives",N(config,"maxLives"),"pendingAdLives",N(state,"pendingAdLives"),"unlimited",Unlimited(state),"unlimitedUntilUtc",until,"unlimitedRemainingMs",until==null?0L:Math.Max(0,N(state,"unlimitedUntilUtc")-time),"nextLifeAtUtc",next,"remainingMs",next==null?0L:Math.Max(0d,Convert.ToDouble(next,CultureInfo.InvariantCulture)-time),"adAvailable",G(ad,"allowed"),"adReason",G(ad,"reason"),"adAvailableAtUtc",G(ad,"availableAtUtc"),"adRemainingMs",G(ad,"waitMs"),"adClaimsToday",N(Ledger(state,"adUsage"),"claims"),"developerBypass",Bypass(state),"ledgerFull",false,"canStart",CanStartReconciled(state,M()),"effectiveNowUtc",time,"clockRolledBack",observed<time);
        }
        private static void CheckedAttempt(Dictionary<string,object> attempt,bool historical)
        {if(attempt==null||!Token(G(attempt,"attemptId"))||!Id(G(attempt,"levelId"))||!(G(attempt,"tutorial")is bool)||!I(G(attempt,"movesUsed"))||!(historical?new[]{"failed","won"}:new[]{"failed","won","restart"}).Any(x=>S(G(attempt,"outcome"),x)))Fail("Invalid life attempt result");if(attempt.ContainsKey("confirmed")&&!(G(attempt,"confirmed")is bool))Fail("Invalid restart confirmation");}
        private Dictionary<string,object> WriteSettlement(Dictionary<string,object> state,string id,Dictionary<string,object> row) { Ledger(state,"settledArchive").Remove(id);Ledger(state,"settledAttempts")[id]=row;Ledger(state,"registeredAttempts").Remove(id);return Compact(state); }
        private LifeOperationResult Settle(LifeState raw,Dictionary<string,object> attempt,bool historical)
        {
            CheckedAttempt(attempt,historical);var state=Reconcile(raw).ToWire();long time=N(state,"lastSeenUtc");string attemptId=(string)G(attempt,"attemptId");var old=Settlement(state,attemptId);var registration=O(G(Ledger(state,"registeredAttempts"),attemptId));
            if(S(G(attempt,"outcome"),"restart")&&!B(G(attempt,"confirmed")))return new LifeOperationResult(state,false,"confirmation_required",false);
            if(registration!=null&&(!E(G(registration,"levelId"),G(attempt,"levelId"))||!E(G(registration,"tutorial"),G(attempt,"tutorial"))))return new LifeOperationResult(state,false,"attempt_identity_mismatch",false);
            if(old!=null){
                if(!E(G(old,"levelId"),G(attempt,"levelId"))||!E(G(old,"tutorial"),G(attempt,"tutorial")))return new LifeOperationResult(state,false,"attempt_identity_mismatch",false);
                if(B(G(old,"discarded"))||S(G(old,"outcome"),"won")||E(G(old,"outcome"),G(attempt,"outcome"))||historical)return new LifeOperationResult(state,false,"already_settled",false);
                if(S(G(attempt,"outcome"),"won")||S(G(attempt,"outcome"),"restart")){if(S(G(attempt,"outcome"),"won")&&B(G(old,"charged"))){old["charged"]=false;old["waiver"]="won";Refund(state);}old["outcome"]=G(attempt,"outcome");old["movesUsed"]=Math.Max(N(old,"movesUsed"),N(attempt,"movesUsed"));if(S(G(attempt,"outcome"),"restart")){old["discarded"]=true;old["discardedAtUtc"]=time;}WriteSettlement(state,attemptId,old);return new LifeOperationResult(state,true,"result_updated",false);}return new LifeOperationResult(state,false,"already_settled",false);
            }
            bool reserved=B(G(registration,"reserved"));string key=LevelKey(G(attempt,"levelId"));bool firstFailure=S(G(attempt,"outcome"),"failed")&&!B(G(attempt,"tutorial"))&&!Ledger(state,"firstFailures").ContainsKey(key);if(firstFailure)Ledger(state,"firstFailures")[key]=attemptId;string waiver=null;
            if(historical)waiver="historical";else if(B(G(attempt,"tutorial")))waiver="tutorial";else if(S(G(attempt,"outcome"),"won"))waiver="won";else if(S(G(attempt,"outcome"),"restart")&&N(attempt,"movesUsed")==0)waiver="no_moves";else if(Bypass(state))waiver="developer_bypass";else if(B(G(registration,"unlimitedAtStart"))||Unlimited(state))waiver="unlimited";else if(firstFailure&&B(G(O(G(config,"firstFailureProtection")),"enabled"))&&Includes(A(G(O(G(config,"firstFailureProtection")),"levelIds")),G(attempt,"levelId"))){waiver="first_failure";Ledger(state,"protectionUsed")[key]=true;}else if(!reserved&&N(state,"lives")==0)waiver="empty";
            bool charged=waiver==null;if(reserved){if(!charged)Refund(state);}else if(charged){if(N(state,"lives")==N(config,"maxLives"))state["regenAnchorUtc"]=time;state["lives"]=N(state,"lives")-1;ApplyPending(state);}
            WriteSettlement(state,attemptId,M("levelId",G(attempt,"levelId"),"tutorial",G(attempt,"tutorial"),"outcome",G(attempt,"outcome"),"movesUsed",G(attempt,"movesUsed"),"settledAtUtc",time,"charged",charged,"waiver",waiver,"discarded",S(G(attempt,"outcome"),"restart"),"discardedAtUtc",S(G(attempt,"outcome"),"restart")?(object)time:null));return new LifeOperationResult(state,true,charged?"life_consumed":waiver,charged);
        }
        public LifeOperationResult SettleAttempt(LifeState raw,Dictionary<string,object> attempt) { return Settle(raw,attempt,false); }
        public LifeOperationResult AcknowledgeHistoricalAttempt(LifeState raw,Dictionary<string,object> attempt) { return Settle(raw,attempt,true); }
        private static bool TransactionSeen(Dictionary<string,object> state,string transactionId)
        {
            if(Ledger(state,"processedTransactions").ContainsKey(transactionId)||Ledger(state,"transactionArchive").ContainsKey(transactionId))return true;
            foreach(var row in Ledger(state,"transactionStreams")){string prefix=row.Key+"-";if(transactionId.StartsWith(prefix,StringComparison.Ordinal)){double serial;string text=transactionId.Substring(prefix.Length);if(double.TryParse(text,NumberStyles.Float,CultureInfo.InvariantCulture,out serial)&&I(serial,1)&&transactionId==prefix+LifeWire.String(serial)&&InRanges(A(G(O(row.Value),"ranges")),(long)serial))return true;}}return false;
        }
        public bool HasTransaction(LifeState raw,object transactionId) { var state=Reconcile(raw).ToWire();return Token(transactionId)&&TransactionSeen(state,(string)transactionId); }
        public LifeOperationResult ApplyTransaction(LifeState raw,LifeTransaction receipt) { return ApplyTransaction(raw,receipt==null?null:receipt.ToWire()); }
        public LifeOperationResult ApplyTransaction(LifeState raw,Dictionary<string,object> receipt)
        {
            var state=Reconcile(raw).ToWire();long time=N(state,"lastSeenUtc");
            if(receipt==null||!Token(G(receipt,"transactionId"))||!Products.Any(x=>S(G(receipt,"productId"),x))||!Token(G(receipt,"provider"))||!S(G(receipt,"status"),"completed")||!I(G(receipt,"verifiedAtUtc"))||N(receipt,"verifiedAtUtc")>time)return new LifeOperationResult(state,false,"invalid_receipt");
            string transactionId=(string)G(receipt,"transactionId");if(TransactionSeen(state,transactionId))return new LifeOperationResult(state,false,"duplicate_transaction");bool streamed=receipt.ContainsKey("streamId")||receipt.ContainsKey("sequence");
            if(streamed&&(!Token(G(receipt,"streamId"))||!I(G(receipt,"sequence"),1)||transactionId!=LifeWire.String(G(receipt,"streamId"))+"-"+LifeWire.String(G(receipt,"sequence"))||Ledger(state,"transactionStreams").ContainsKey(LifeWire.String(G(receipt,"streamId")))&&!E(G(O(G(Ledger(state,"transactionStreams"),LifeWire.String(G(receipt,"streamId")))),"provider"),G(receipt,"provider"))))return new LifeOperationResult(state,false,"invalid_receipt");
            bool verified=false;try{verified=verifier!=null&&verifier.Verify(new LifeTransaction(receipt));}catch(Exception){}if(!verified)return new LifeOperationResult(state,false,"unverified_receipt");
            var available=Availability(state,G(receipt,"productId"),true);string reason=B(G(available,"allowed"))?"granted":(string)G(available,"reason");if(B(G(available,"allowed"))&&S(G(receipt,"productId"),"ad_life")&&!I(N(state,"pendingAdLives")+N(O(G(config,"ads")),"rewardLives")))reason="credit_overflow";bool granted=B(G(available,"allowed"))&&reason!="credit_overflow";
            var record=M("productId",G(receipt,"productId"),"provider",G(receipt,"provider"),"verifiedAtUtc",G(receipt,"verifiedAtUtc"),"processedAtUtc",time,"result",granted?"granted":"rejected","reason",reason);
            if(streamed){record["streamId"]=G(receipt,"streamId");record["sequence"]=G(receipt,"sequence");string streamId=(string)G(receipt,"streamId");var stream=O(G(Ledger(state,"transactionStreams"),streamId))??M("provider",G(receipt,"provider"),"ranges",new List<object>());stream["ranges"]=AddRange(A(G(stream,"ranges")),N(receipt,"sequence"));Ledger(state,"transactionStreams")[streamId]=stream;}
            Ledger(state,"processedTransactions")[transactionId]=record;if(!granted)return new LifeOperationResult(Compact(state),false,reason);
            if(S(G(receipt,"productId"),"unlimited_lives_30m")){long until=Math.Max(time,G(state,"unlimitedUntilUtc")==null?0:N(state,"unlimitedUntilUtc"))+N(O(G(O(G(config,"products")),"unlimited_lives_30m")),"durationMs");if(!I(until)){record["result"]="rejected";record["reason"]="time_overflow";return new LifeOperationResult(Compact(state),false,"time_overflow");}state["unlimitedUntilUtc"]=until;}
            else if(S(G(receipt,"productId"),"ad_life")){state["pendingAdLives"]=N(state,"pendingAdLives")+N(O(G(config,"ads")),"rewardLives");ApplyPending(state);var ad=Ledger(state,"adUsage");ad["claims"]=N(ad,"claims")+1;ad["lastClaimUtc"]=time;if(N(state,"pendingAdLives")>0){reason="banked";record["reason"]=reason;}}
            else{long amount=S(G(receipt,"productId"),"refill_lives")?N(config,"maxLives"):N(O(G(O(G(config,"products")),"single_life")),"amount");state["lives"]=Math.Min(N(config,"maxLives"),N(state,"lives")+amount);if(N(state,"lives")==N(config,"maxLives"))state["regenAnchorUtc"]=null;}
            return new LifeOperationResult(Compact(state),true,reason);
        }
        public LifeOperationResult SetDeveloperBypass(LifeState raw,object enabled)
        {var state=Reconcile(raw).ToWire();if(!(enabled is bool))Fail("Developer bypass must be boolean");if(B(enabled)&&!B(G(O(G(config,"development")),"allowBypass")))return new LifeOperationResult(state,false,"developer_bypass_disabled");bool changed=!E(G(state,"developerBypass"),enabled);state["developerBypass"]=enabled;return new LifeOperationResult(state,changed,changed?"updated":"unchanged");}
    }
}
