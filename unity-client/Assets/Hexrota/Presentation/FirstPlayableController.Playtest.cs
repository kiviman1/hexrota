using System;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private void DrawPlaytestSettings(float y)
        {
            OptionBox("Yerel oyuncu testi",18,y,316,223,"fff6dd","fbefd7","e5b87a",15,1);
            var status=OptionText("PlaytestStatus","İSTEĞE BAĞLI YEREL TEST",32,y+10,288,22,10,TextAnchor.MiddleLeft,true);
            OptionSwitch("Oyuncu testi kaydı","Oyuncu testi kaydı",
                "Hamleler ve aktif oyun süresi yalnızca bu cihazda saklanır. Kişisel veri toplanmaz veya gönderilmez.",
                y+33,Session.PlaytestEnabled,Session.SetPlaytestEnabled,inset:true);
            OptionButton("Test sonucunu JSON olarak kaydet",32,y+119,288,44,()=>{
                try
                {
                    string path=Session.SavePlaytestExport(UnityEngine.Application.persistentDataPath);
                    OptionsPanel("playtest-export","Oyuncu testi kaydedildi.","YEREL JSON DOSYASI",
                        "Dosyayı bu cihazda bulabilirsin.",405,405);
                    var location=OptionText("ExportPath",path,25,170,307,132,12);
                    location.horizontalOverflow=HorizontalWrapMode.Wrap;
                    OptionButton("Ayarlara dön",18,322,316,44,OpenMobileSettings);
                }
                catch { status.text="Dosya kaydedilemedi."; }
            });
            OptionButton("Yalnızca test kaydını temizle",32,y+170,288,38,()=>{
                Session.ClearPlaytestData();status.text="Yalnızca oyuncu testi kaydı temizlendi.";
            });
        }
    }
}
