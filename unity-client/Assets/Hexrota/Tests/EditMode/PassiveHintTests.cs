using System;
using Hexrota.Gameplay;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    public sealed class PassiveHintTests
    {
        private static HexMatch Board(string document,int index)
        {
            var source = Resources.Load<TextAsset>("HexrotaData/"+document);
            var level = JObject.Parse(source.text)["levels"][index].ToObject<LevelConfig>();
            return new HexMatch(level);
        }

        // Expected descriptors from dist/idle-hints.js over these exact boards.
        [TestCase("levels-original",0,3,6,"1,2,3,4,11")]
        [TestCase("obstacle-levels-v1",0,0,3,"0,4,5")]
        [TestCase("obstacle-levels-v1",2,2,7,"2,12,18")]
        [TestCase("material-alpha-levels-v1",0,1,7,"1,15,16")]
        [TestCase("material-alpha-levels-v1",1,10,2,"9,10,16")]
        public void VisibleFirstMatchAgreesWithThePhoneGame(string file,int index,int moving,int target,string sources)
        {
            var board = Board(file,index);
            var before = board.Snapshot();
            var hint = VisibleIdleHint.Choose(board);
            Assert.That(hint.MovingSource,Is.EqualTo(moving));
            Assert.That(hint.MovingTarget,Is.EqualTo(target));
            Assert.That(string.Join(",",hint.FocusSources),Is.EqualTo(sources));
            Assert.That(board.values,Is.EqualTo(before.values));
            Assert.That(board.rngState,Is.EqualTo(before.rngState));
            Assert.That(board.blockerHp,Is.EqualTo(before.blockerHp));
            Assert.That(board.materialCounts,Is.EqualTo(before.materialCounts));
            Assert.That(board.turn,Is.Zero);
        }

        [Test]
        public void TouchCancelsRepeatsAndOnlyPersistedPlayerMovesRearmTheSecondCue()
        {
            var clock = new IdleHintClock();
            var board = Board("levels-original",0);
            int scans = 0;
            Func<int[],VisibleIdleHint> choose = previous => { scans++; return VisibleIdleHint.Choose(board,previous); };
            clock.Bind("level-1:1","board-A");
            clock.Tick(1,true,choose); clock.Tick(10.99,true,choose);
            Assert.That(clock.Visible,Is.Null);
            clock.Tick(11,true,choose);
            var first = clock.Visible;
            Assert.That(first,Is.Not.Null);
            clock.Tick(12.81,true,choose);
            Assert.That(clock.Visible,Is.Null);
            clock.Tick(14.61,true,choose);
            Assert.That(clock.Visible,Is.SameAs(first));
            clock.Interrupt();
            clock.Tick(15,true,choose); clock.Tick(70,true,choose);
            Assert.That(scans,Is.EqualTo(1));
            clock.PlayerMoved("board-B"); clock.Bind("level-1:1","board-B");
            clock.Tick(70,true,choose); clock.Tick(104.99,true,choose);
            Assert.That(clock.Visible,Is.Null);
            clock.Tick(105,true,choose);
            Assert.That(clock.Visible.Pair,Is.Not.EqualTo(first.Pair));
            clock.PlayerMoved("board-C"); clock.Bind("level-1:1","board-C");
            clock.Tick(106,true,choose); clock.Tick(179,true,choose);
            Assert.That(scans,Is.EqualTo(2));
            clock.Bind("level-2:2","board-D"); clock.Tick(180,false,choose);
            clock.Tick(195,true,choose); clock.Tick(204.9,true,choose);
            Assert.That(clock.Visible,Is.Null);
            clock.Tick(205,true,choose);
            Assert.That(scans,Is.EqualTo(3));
        }
    }
}
