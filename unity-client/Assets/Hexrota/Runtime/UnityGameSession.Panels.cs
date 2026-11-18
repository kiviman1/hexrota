using System;
using System.Linq;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    public sealed partial class UnityGameSession
    {
        public int PreviewRestartCharge() { return controller.PreviewRestartCharge(); }

        public sealed class StageRecord
        {
            public int Score, Moves;
            public bool Assisted;
        }
        public StageRecord ReadStageRecord(int index)
        {
            var game=controller.GameSave;
            var row=W.Get(game["records"],index.ToString());
            if(row==null)return null;
            var completed=W.Map(W.Required(game["economy"],"transactions")).Values.Any(tx=>
                W.Equal(W.Get(tx,"kind"),"clear") && W.Equal(W.Get(tx,"levelId"),data.Levels[index]["id"]) && W.Equal(W.Get(tx,"assisted"),true));
            return new StageRecord {Score=W.Int32(W.Required(row,"score")),Moves=W.Int32(W.Required(row,"movesLeft")),Assisted=completed};
        }
        public sealed class EarnedResult
        {
            public int Gold,Stars;
            public bool Welcome,Assisted;
            public string Gift,Headline;
        }
        public EarnedResult ReadEarnedResult()
        {
            var earned=new EarnedResult();
            var ledger=W.Map(W.Required(controller.GameSave["economy"],"transactions"));
            var attempt=W.Get(W.Required(controller.View(),"metadata"),"attemptId");
            foreach(var row in ledger.Values.Where(row=>W.Equal(W.Get(row,"attemptId"),attempt)))
            {
                switch(W.Get(row,"kind") as string)
                {
                    case "welcome":
                        earned.Welcome=true;earned.Gold=W.Int32(W.Required(data.EconomyConfig["welcome"],"gold"));break;
                    case "clear":
                        earned.Gold=W.Int32(W.Required(data.EconomyConfig["reward"],"gold"));
                        earned.Stars=W.Int32(W.Required(data.EconomyConfig["reward"],"stars"));
                        earned.Assisted=W.Equal(W.Get(row,"assisted"),true);break;
                    case "gift":
                        string item=(string)W.Required(row,"itemId");
                        earned.Gift="+"+W.Required(W.Required(data.EconomyConfig["inventory"],item),"gift")+" "+(item=="greenBrush"?"Yeşil Fırça":"Renk Anahtarı");
                        break;
                }
            }
            var headline=controller.LastRewardPlan?.headline;
            if(headline!=null && headline.completion)
                earned.Headline=headline.labelKey=="last_move_win"?"Tam zamanında!":"Yeşil rota tamam!";
            return earned;
        }
        public sealed class BotanicalMilestone
        {
            public string Id;
            public int Stars;
            public bool Unlocked;
        }
        public BotanicalMilestone[] GardenMilestones()
        {
            return W.List(controller.EconomyView["botanical"]).Select(e=>new BotanicalMilestone{
                Id=(string)W.Required(e,"id"),Stars=W.Int32(W.Required(e,"stars")),Unlocked=W.Equal(W.Required(e,"unlocked"),true)
            }).ToArray();
        }

        public sealed class RescueAdOffer
        {
            public bool Available,PendingDelivery;
            public int Moves,Price,Remaining;
            public string PendingId,Reason;
        }
        public RescueAdOffer ReadRescueAd()
        {
            if(!HasAttempt || IsTutorial || Status!="lost")return null;
            var offer=controller.RescueOffer();
            var ad=offer["ad"];
            string reason=W.Get(ad,"reason") as string;
            string id=W.Get(ad,"pendingTransactionId") as string;
            bool delivery=controller.HasPendingRescueDelivery || reason=="receipt_pending_delivery";
            return new RescueAdOffer{
                Moves=W.Int32(offer["moves"]),Price=W.Int32(offer["costGold"]), Remaining=W.Int32(W.Required(ad,"remainingToday")),
                Available=W.Equal(W.Get(ad,"allowed"),true)||id!=null||delivery,Reason=reason,PendingId=id,PendingDelivery=delivery
            };
        }
        public string BeginMobileRescueAd()
        {
            if(!HasAttempt || Status!="lost")return null;
            string id=null;
            bool ok=Apply(()=>{var result=controller.BeginRescueAd(Command());id=W.Get(result,"transactionId") as string;return result;});
            return ok?id:null;
        }
        public bool CompleteMobileRescueAd(string id,bool completed)
        {
            return id!=null && Apply(()=>controller.CompleteRescueAd(id,completed?"completed":"cancelled",Command()));
        }
        public bool DeliverMobileRescueAd() { return Apply(()=>controller.RetryPendingRescueDelivery(Command())); }
    }
}
