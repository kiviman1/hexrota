using UnityEngine;
using UnityEngine.EventSystems;

namespace Hexrota.UnityClientTests
{
    // A single native-style touch sample. The real scene's input module still
    // performs the GraphicRaycaster hit test, press capture and drag threshold.
    public sealed class PhoneTouchInput : BaseInput
    {
        private Touch touch;
        private bool available;
        public override int touchCount { get { return available ? 1 : 0; } }
        public override bool mousePresent { get { return false; } }
        public override Touch GetTouch(int index) { return touch; }

        public void Sample(StandaloneInputModule module,TouchPhase phase,Vector2 position)
        {
            touch = new Touch { fingerId=7, position=position, rawPosition=position, type=TouchType.Direct, phase=phase, tapCount=1 };
            available=true;
            try {module.Process();}
            finally {available=false;}
        }
    }
}
