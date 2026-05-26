using System;
using System.Collections.Generic;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace JellyCMS
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
    {
        public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
        }

        public static Plugin? Instance { get; private set; }

        public override string Name => "JellyCMS";

        public override Guid Id => Guid.Parse("f9c8d5c4-4b5c-4d5c-9c5d-4f5b5c5d5e5f");

        public override string Description => "A Visual Content Management System for Jellyfin.";

        public IEnumerable<PluginPageInfo> GetPages()
        {
            return new[]
            {
                new PluginPageInfo
                {
                    Name = "JellyCMS",
                    EmbeddedResourcePath = $"{GetType().Namespace}.Web.Pages.cms_admin.html",
                    EnableInMainMenu = true,
                    MenuIcon = "web",
                    MenuSection = "server",
                    DisplayName = "JellyCMS"
                }
            };
        }
    }

    public class PluginConfiguration : BasePluginConfiguration
    {
        public bool EnableCaching { get; set; } = true;
    }
}
