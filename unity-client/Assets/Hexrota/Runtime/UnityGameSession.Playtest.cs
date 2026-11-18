using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    public sealed partial class UnityGameSession
    {
        private LocalPlaytest playtest;
        private long nextObservedEvent;
        private string timedAttempt;
        public bool PlaytestEnabled {get{return playtest.Enabled;}}

        private void StartPlaytestObservation(Hexrota.Application.IProfileStorage storage,Hexrota.Lives.IUtcClock clock,Func<long> milliseconds)
        {
            var timer=System.Diagnostics.Stopwatch.StartNew();
            playtest=new LocalPlaytest(storage,clock.NowUtcMilliseconds,milliseconds??(()=>timer.ElapsedMilliseconds));
            if(playtest.Enabled)nextObservedEvent=W.Integer(controller.EventSave["nextSequence"]);
        }
        public void SetPlaytestEnabled(bool value)
        {
            nextObservedEvent=W.Integer(controller.EventSave["nextSequence"]);
            timedAttempt=null; playtest.SetEnabled(value);
        }
        public void ClearPlaytestData(bool resetConsent=false)
        {
            nextObservedEvent=W.Integer(controller.EventSave["nextSequence"]);
            timedAttempt=null;playtest.Clear(resetConsent);
        }
        public void SetPlaytestActivity(bool playing)
        {
            if(!PlaytestEnabled)return;
            if(playing && timedAttempt==null)
                timedAttempt=W.Get(controller.View()["metadata"],"attemptId") as string;
            if(!playing)timedAttempt=null;
            playtest.Activity(timedAttempt);
        }
        public Dictionary<string,object> ExportPlaytestData(){return playtest.Export();}
        public string SavePlaytestExport(string directory)
        {
            new FileProfileStorage(directory).WriteObservation("hexrota-playtest",ExportPlaytestData());
            return Path.Combine(directory,"hexrota-playtest.json");
        }

        private void ObserveCommit(Dictionary<string,object> outcome,int? requestedStage=null,MovePresentation move=null)
        {
            if(!PlaytestEnabled)return;
            try
            {
                bool bypass=(bool)LifeStatus["developerBypass"];
                if(move!=null && move.Ok && move.Swap!=null)
                {
                    var level=Level;
                    var cells=new[]{level.cells[move.A],level.cells[move.B]}.Select(c=>(object)W.Obj("q",c.q,"r",c.r)).ToList();
                    var matched=move.Swap.frames.SelectMany(w=>w.matched).Distinct().Select(v=>(object)(long)v).ToList();
                    playtest.Move(W.Obj("attemptId",W.Get(controller.View()["metadata"],"attemptId"),"turn",move.After.turn,
                        "pair",W.Arr(move.A,move.B),"cells",cells,"scoreBefore",move.Before.score,"scoreAfter",move.After.score,
                        "movesRemaining",move.After.movesLeft,"coveredBefore",move.Before.layers.Count(l=>l==0),"coveredAfter",move.After.layers.Count(l=>l==0),
                        "remainingLayers",move.After.layers.Sum(),"waves",move.Swap.frames.Length,"matchedIndices",matched,"developerBypass",bypass));
                }
                var events=controller.EventSave;
                var added=W.List(events["events"]).Where(e=>W.Integer(W.Get(e,"sequence"))>=nextObservedEvent).ToArray();
                foreach(var row in added)playtest.Event((string)W.Get(row,"name"),row,bypass);
                nextObservedEvent=W.Integer(events["nextSequence"]);
                string reason=W.Get(outcome,"reason") as string;
                if(reason=="resumed"||reason=="rescue_ready")
                    playtest.Event("attempt_resumed",controller.PlaytestContext(),bypass);
                if(reason=="lives_empty" && requestedStage.HasValue)
                    playtest.Event("life_blocked",W.Obj("requestedLevelId",data.Levels[requestedStage.Value]["id"],"lives",LifeStatus["lives"],"reason",reason),bypass);
                if(move!=null && Status=="lost" && !added.Any(e=>W.Equal(W.Get(e,"name"),"level_failed")))
                {
                    var context=controller.PlaytestContext();context["reason"]="post_rescue_failure";
                    playtest.Event("level_failed",context,bypass);
                }
                if(move!=null || added.Length>0 || reason=="resumed" || reason=="rescue_ready" || reason=="lives_empty")
                    playtest.Save();
            }
            catch { /* A local observer cannot reject a move, disturb RNG or affect settlement. */ }
        }
    }
}
