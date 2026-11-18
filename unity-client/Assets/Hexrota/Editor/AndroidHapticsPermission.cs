#if UNITY_ANDROID
using System.IO;
using System.Linq;
using System.Xml.Linq;
using UnityEditor.Android;

namespace Hexrota.UnityClient.Editor
{
    // Android's Vibrator service is called through the JNI bridge.
    public sealed class AndroidHapticsPermission : IPostGenerateGradleAndroidProject
    {
        public int callbackOrder => 0;

        public void OnPostGenerateGradleAndroidProject(string projectPath)
        {
            var manifestPath = Path.Combine(projectPath, "src", "main", "AndroidManifest.xml");
            var manifest = XDocument.Load(manifestPath);
            XNamespace android = "http://schemas.android.com/apk/res/android";
            const string permission = "android.permission.VIBRATE";
            if (manifest.Root.Elements("uses-permission").Any(p => (string)p.Attribute(android + "name") == permission))
                return;
            manifest.Root.AddFirst(new XElement("uses-permission", new XAttribute(android + "name", permission)));
            manifest.Save(manifestPath);
        }
    }
}
#endif
