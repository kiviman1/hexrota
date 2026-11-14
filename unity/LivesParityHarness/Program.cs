using System;
using System.Collections.Generic;
using Hexrota.Contracts;
using Hexrota.Lives;
using Hexrota.ParitySupport;

internal sealed class TestClock : IUtcClock
{
    public object Value;
    public long NowUtcMilliseconds() { if(!Wire.IsSafeInteger(Value)||Wire.Number(Value)<0)throw new ArgumentException("Clock must return UTC milliseconds as a safe non-negative integer");return Wire.Integer(Value); }
}
internal sealed class TestVerifier : IReceiptVerifier
{
    public readonly HashSet<string> Trusted = new HashSet<string>(StringComparer.Ordinal);
    public bool Throws;
    public readonly List<object> Calls = new List<object>();
    public bool Verify(LifeTransaction receipt) { Calls.Add(receipt.ToWire());if(Throws)throw new Exception("test verifier unavailable");return Trusted.Contains(WireJson.Serialize(receipt.ToWire())); }
}
internal static class Program
{
    private static Dictionary<string,object> M(object value) { return value as Dictionary<string,object>; }
    private static object G(Dictionary<string,object> value,string key) { return Wire.Get(value,key); }
    private static LifeState State(object value) { return M(value)==null?null:new LifeState(M(value)); }
    private static object Execute(Dictionary<string,object> request)
    {
        var clock=new TestClock{Value=G(request,"utc")};var verifier=new TestVerifier();var configuration=M(G(request,"config"));string operation=(string)G(request,"operation");
        if(operation=="validateConfig")return LifeManager.ValidateConfig(configuration);
        var manager=new LifeManager(configuration,clock,verifier);
        if(operation=="scenario"){
            var scenario=M(G(request,"scenario"));clock.Value=G(scenario,"initialUtc");var state=manager.CreateState();var initial=state.ToWire();var steps=new List<object>();
            foreach(var item in Wire.List(G(scenario,"steps"))){var step=M(item);var op=M(G(step,"operation"));if(op.ContainsKey("atUtc"))clock.Value=G(op,"atUtc");string before=WireJson.Serialize(state.ToWire());object outcome=null;LifeOperationResult result=null;
                switch((string)G(op,"kind")){
                    case "settle":result=manager.SettleAttempt(state,M(G(op,"context")));break;
                    case "register":result=manager.RegisterAttempt(state,M(G(op,"context")));break;
                    case "historical":result=manager.AcknowledgeHistoricalAttempt(state,M(G(op,"context")));break;
                    case "transaction":if(Equals(G(op,"verified"),true))verifier.Trusted.Add(WireJson.Serialize(G(op,"receipt")));result=manager.ApplyTransaction(state,M(G(op,"receipt")));break;
                    case "bypass":result=manager.SetDeveloperBypass(state,G(op,"enabled"));break;
                    case "reconcile":state=manager.Reconcile(state);break;
                    case "reload":state=manager.Restore(state.ToWire());break;
                    case "canStart":outcome=Wire.Obj("allowed",op.ContainsKey("context")?manager.CanStart(state,G(op,"context")):manager.CanStart(state));break;
                    case "canResume":outcome=Wire.Obj("allowed",manager.CanResume(state,G(op,"attemptId")));break;
                    default:throw new ArgumentException("Unknown vector operation");
                }
                if(result!=null){var wire=result.ToWire();state=result.State;wire.Remove("state");outcome=wire;}
                // Inputs were detached by the DTO and each reducer; the Node side
                // separately compares all original argument objects after every call.
                steps.Add(Wire.Obj("state",state.ToWire(),"view",manager.View(state),"outcome",outcome));
            }
            return Wire.Obj("initial",initial,"steps",steps);
        }
        if(operation=="restore"){
            object raw=G(request,"state");var state=raw!=null&&M(raw)==null?manager.Reconcile(null):manager.Restore(M(raw));return Wire.Obj("state",state.ToWire(),"view",manager.View(state));
        }
        if(operation=="validate")return manager.ValidateState(M(G(request,"state")));
        if(operation=="call"){
            var state=State(G(request,"state"));object result;string method=(string)G(request,"method");var argument=M(G(request,"argument"));
            if(request.ContainsKey("trusted"))foreach(object receipt in Wire.List(G(request,"trusted")))verifier.Trusted.Add(WireJson.Serialize(receipt));
            verifier.Throws=Equals(G(request,"verifierThrows"),true);
            switch(method){
                case "reconcile":result=manager.Reconcile(state).ToWire();break;
                case "view":result=manager.View(state);break;
                case "canStart":result=request.ContainsKey("argument")?manager.CanStart(state,G(request,"argument")):manager.CanStart(state);break;
                case "canResume":result=manager.CanResume(state,G(request,"argument"));break;
                case "registerAttempt":result=manager.RegisterAttempt(state,argument).ToWire();break;
                case "registeredAttemptFor":result=manager.RegisteredAttemptFor(state,G(request,"argument"));break;
                case "settlementFor":var settlement=manager.SettlementFor(state,G(request,"argument"));result=settlement==null?null:settlement.ToWire();break;
                case "settleAttempt":result=manager.SettleAttempt(state,argument).ToWire();break;
                case "acknowledgeHistoricalAttempt":result=manager.AcknowledgeHistoricalAttempt(state,argument).ToWire();break;
                case "applyTransaction":result=manager.ApplyTransaction(state,argument).ToWire();break;
                case "transactionAvailability":result=manager.TransactionAvailability(state,G(request,"argument"));break;
                case "hasTransaction":result=manager.HasTransaction(state,G(request,"argument"));break;
                case "setDeveloperBypass":result=manager.SetDeveloperBypass(state,G(request,"argument")).ToWire();break;
                default:throw new ArgumentException("Unknown method");
            }
            return Wire.Obj("result",result,"unchangedInput",state.ToWire(),"verificationCalls",verifier.Calls);
        }
        throw new ArgumentException("Unknown request");
    }
    private static void Main()
    {
        string line;while((line=Console.ReadLine())!=null){Dictionary<string,object> input=null;string before=null;try{input=M(WireJson.Parse(line));before=WireJson.Serialize(input);var output=Execute(input);Console.WriteLine(WireJson.Serialize(Wire.Obj("output",output,"inputUnchanged",before==WireJson.Serialize(input))));}catch(Exception error){Console.WriteLine(WireJson.Serialize(Wire.Obj("output",Wire.Obj("error",true,"name",error is LifeTypeException?"TypeError":"Error","message",error.Message),"inputUnchanged",input==null||before==WireJson.Serialize(input))));}}
    }
}
