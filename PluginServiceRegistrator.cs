using System.IO;
using JellyCMS.Database;
using JellyCMS.Services;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace JellyCMS
{
    public class PluginServiceRegistrator : IPluginServiceRegistrator
    {
        public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
        {
            serviceCollection.AddTransient<CmsDbContext>(sp =>
            {
                var appPaths = sp.GetRequiredService<IApplicationPaths>();
                var dbPath = Path.Combine(appPaths.DataPath, "cms_data.db");
                return new CmsDbContext(dbPath);
            });

            serviceCollection.AddSingleton<BlockManager>();
            serviceCollection.AddSingleton<PageCompiler>();
        }
    }
}
