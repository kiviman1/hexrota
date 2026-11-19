using System;
using System.Linq;
using Hexrota.Catalog;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    public sealed partial class UnityGameSession
    {
        // Match state-selectors.js committedTutorialProgress, including a numbered
        // attempt started from the map before the lessons have been replayed.
        public int CompletedSceneTutorials
        {
            get
            {
                var save=controller.GameSave;
                int furthest=(int)W.Integer(W.Get(save,"current") ?? 0L);
                foreach(string key in W.Map(save["boards"]).Keys.Concat(W.Map(save["attempts"]).Keys))
                    furthest=Math.Max(furthest,int.Parse(key,System.Globalization.CultureInfo.InvariantCulture));
                var done=W.List(save["done"]);
                if(furthest>=TutorialCount || done.Any(value=>W.Int32(value)>=1)) return 2;
                return furthest==1 || done.Any(value=>W.Int32(value)==0) ? 1 : 0;
            }
        }

        public sealed class PhoneWallet
        {
            public int Lives, Maximum, Gold, Stars, Brushes, Keys;
            public string Timer, Countdown;
        }

        public PhoneWallet ReadPhoneWallet()
        {
            var life = controller.View()["life"];
            var wallet = controller.EconomyView;
            bool unlimited = W.Equal(W.Get(life, "unlimited"), true);
            long seconds = (long)Math.Ceiling(Convert.ToDouble(W.Get(life, unlimited ? "unlimitedRemainingMs" : "remainingMs")) / 1000);
            string time = (seconds / 60) + ":" + (seconds % 60).ToString("00");
            return new PhoneWallet {
                Lives = W.Int32(W.Required(life, "lives")), Maximum = W.Int32(W.Required(life, "maxLives")),
                Gold = W.Int32(wallet["gold"]), Stars = W.Int32(wallet["stars"]),
                Brushes = W.Int32(W.Required(wallet["inventory"], "greenBrush")), Keys = W.Int32(W.Required(wallet["inventory"], "colorKey")),
                Timer = W.Get(life, "nextLifeAtUtc") != null ? "Sonraki can " + time : unlimited ? time : "Canlar dolu",
                Countdown = unlimited || W.Get(life, "nextLifeAtUtc") != null ? time : null
            };
        }

        public sealed class ChapterPreview
        {
            public int ScoreTarget, Cells, Green, Moves;
            public bool Resume, Rescue;
        }

        public ChapterPreview GetChapterPreview(int index)
        {
            if (!CanOpenStage(index)) return null;
            var preview = controller.Preview(index);
            var checkpoint = W.Get(preview, "snapshot");
            var level = data.Levels[index];
            bool resume = W.Equal(preview["resume"], true);
            bool rescue = index == ActiveStage && Status == "lost" && W.Equal(W.Get(controller.RescueOffer(), "eligible"), true);
            if (checkpoint != null && index >= TutorialCount && (resume || rescue || W.Int32(W.Required(checkpoint,"turn")) == 0))
            {
                var metadata = W.Required(preview,"metadata");
                level = data.Catalog.ResolveLevelWire(W.Required(metadata,"levelId"), (string)W.Required(metadata,"variantId"), (string)W.Required(metadata,"levelDataVersion"));
            }
            var board = resume ? ReadBoardForDisplay(checkpoint) : null;
            return new ChapterPreview {
                ScoreTarget = W.Int32(level["target"]), Cells = W.List(level["cells"]).Count,
                Moves = resume ? board.movesLeft : W.Int32(level["moves"]), Green = resume ? board.layers.Count(layer => layer == 0) : 0,
                Resume = resume, Rescue = rescue
            };
        }

        public bool StartChapterFresh(int index)
        {
            if (!CanOpenStage(index)) return false;
            CancelPresentation();
            inGame = Apply(() => controller.Enter(index, fresh:true, confirmed:true), index);
            return inGame;
        }
    }
}
