using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading.Tasks;
using JellyCMS.Database;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace JellyCMS.Services
{
    public class PageCompiler
    {
        private readonly BlockManager _blockManager;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<PageCompiler> _logger;

        public PageCompiler(BlockManager blockManager, IMemoryCache memoryCache, ILogger<PageCompiler> logger)
        {
            _blockManager = blockManager;
            _memoryCache = memoryCache;
            _logger = logger;
        }

        public void EvictCache(string slug)
        {
            // Cache is bypassed to ensure instant page updates and avoid user token mismatches.
        }

        public async Task<string> CompilePageAsync(PageEntity page, GlobalSettingEntity globalSettings, string apiToken, string userId, string userName = "", string userImageTag = "")
        {
            return await BuildHtmlDocumentAsync(page, globalSettings, apiToken, userId, userName, userImageTag);
        }

        private async Task<string> BuildHtmlDocumentAsync(PageEntity page, GlobalSettingEntity globalSettings, string apiToken, string userId, string userName, string userImageTag)
        {
            List<BlockInstance> instances;
            try
            {
                instances = JsonSerializer.Deserialize<List<BlockInstance>>(page.LayoutSchema, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? new List<BlockInstance>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JellyCMS: Failed to parse LayoutSchema for page {PageId}", page.Id);
                instances = new List<BlockInstance>();
            }

            var uniqueBlockIds = instances.Select(inst => inst.BlockId).Distinct().ToList();
            var blocksDir = _blockManager.GetBlocksDirectory();

            var templatesHtmlList = new List<string>();
            var scriptsList = new List<string>();

            foreach (var blockId in uniqueBlockIds)
            {
                var blockPath = Path.Combine(blocksDir, blockId);
                if (!Directory.Exists(blockPath)) continue;

                var templatePath = Path.Combine(blockPath, "template.html");
                var stylePath = Path.Combine(blockPath, "style.css");
                var elementPath = Path.Combine(blockPath, "element.js");

                var styleContent = File.Exists(stylePath) ? await File.ReadAllTextAsync(stylePath) : string.Empty;
                var templateContent = File.Exists(templatePath) ? await File.ReadAllTextAsync(templatePath) : string.Empty;
                var elementContent = File.Exists(elementPath) ? await File.ReadAllTextAsync(elementPath) : string.Empty;

                var templateWrapper = $"<template id=\"tpl-jf-{blockId}\">\n" +
                                      $"  <style>\n{styleContent}\n  </style>\n" +
                                      $"  {templateContent}\n" +
                                      $"</template>";
                templatesHtmlList.Add(templateWrapper);

                if (!string.IsNullOrEmpty(elementContent))
                {
                    scriptsList.Add($"<!-- Block script: {blockId} -->\n<script>\n{elementContent}\n</script>");
                }
            }

            var responsiveCss = BuildResponsiveCss(instances);

            var bodyContent = string.Join("\n", instances.Select(inst =>
            {
                var attrs = string.Join(" ", inst.Settings.Select(kvp =>
                {
                    var valStr = kvp.Value?.ToString() ?? string.Empty;
                    return $"data-{HtmlEncoder.Default.Encode(kvp.Key)}=\"{HtmlEncoder.Default.Encode(valStr)}\"";
                }));

                return $"<div id=\"inst-{inst.Id}\" class=\"jf-block-wrapper\">\n" +
                       $"  <jf-{inst.BlockId} {attrs}></jf-{inst.BlockId}>\n" +
                       $"</div>";
            }));

            var builderCoreJs = string.Empty;
            try
            {
                var assembly = typeof(PageCompiler).Assembly;
                var resourceName = assembly.GetManifestResourceNames()
                    .FirstOrDefault(n => n.EndsWith("builder-core.js", StringComparison.OrdinalIgnoreCase));
                if (resourceName != null)
                {
                    using var stream = assembly.GetManifestResourceStream(resourceName);
                    if (stream != null)
                    {
                        using var reader = new StreamReader(stream);
                        builderCoreJs = await reader.ReadToEndAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JellyCMS: Failed to load embedded builder-core.js");
            }

            var seoTags = string.Empty;
            var layoutStyles = "#jellycms-root { display: flex; flex-wrap: wrap; width: 100%; gap: 16px; padding: 24px; box-sizing: border-box; }\n" +
                               ".jf-block-wrapper { box-sizing: border-box; width: 100%; }\n";
            try
            {
                using var seoDoc = JsonDocument.Parse(page.SeoMetadata);
                var root = seoDoc.RootElement;
                if (root.TryGetProperty("description", out var desc))
                {
                    seoTags += $"<meta name=\"description\" content=\"{HtmlEncoder.Default.Encode(desc.GetString() ?? string.Empty)}\">\n";
                }
                if (root.TryGetProperty("keywords", out var kw))
                {
                    seoTags += $"<meta name=\"keywords\" content=\"{HtmlEncoder.Default.Encode(kw.GetString() ?? string.Empty)}\">\n";
                }
                if (root.TryGetProperty("author", out var auth))
                {
                    seoTags += $"<meta name=\"author\" content=\"{HtmlEncoder.Default.Encode(auth.GetString() ?? string.Empty)}\">\n";
                }

                var pageLayout = root.TryGetProperty("pageLayout", out var layoutProp) ? layoutProp.GetString() : "full-width";
                var maxWidth = root.TryGetProperty("maxWidth", out var mwProp) ? mwProp.GetString() : "1200px";
                var bgColor = root.TryGetProperty("backgroundColor", out var bgProp) ? bgProp.GetString() : "";

                if (pageLayout == "contained")
                {
                    layoutStyles += $"#jellycms-root {{ max-width: {maxWidth}; margin-left: auto; margin-right: auto; width: 100%; }}\n";
                }
                else if (pageLayout == "grid")
                {
                    layoutStyles += $"#jellycms-root {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; width: 100%; max-width: {maxWidth}; margin-left: auto; margin-right: auto; }}\n";
                }

                if (!string.IsNullOrEmpty(bgColor))
                {
                    layoutStyles += $"body {{ background-color: {bgColor}; }}\n";
                }
            }
            catch
            {
                // Fallback for corrupt JSON
            }

            var html = $@"<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>{HtmlEncoder.Default.Encode(page.Title)}</title>
  <link rel=""stylesheet"" href=""https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"" />
  {seoTags}
  {globalSettings.GlobalHeadHtml}
  <style id=""jf-global-css"">
{globalSettings.GlobalCss}
  </style>

  <!-- Page Layout Settings -->
  <style id=""jf-layout-css"">
{layoutStyles}
  </style>
  
  <!-- Encapsulated Block Templates -->
  {string.Join("\n", templatesHtmlList)}

  <!-- Responsive Ruleset Styles -->
  <style id=""jf-responsive-css"">
{responsiveCss}
  </style>

  <!-- Jellyfin Core Context -->
  <script id=""jf-builder-context"">
    window.JellyBuilder = {{
      ServerUrl: window.location.origin,
      ApiToken: ""{apiToken}"",
      UserId: ""{userId}"",
      UserName: ""{userName.Replace("\"", "\\\"")}"",
      UserImageTag: ""{userImageTag}""
    }};
  </script>

  <!-- Core Injected Helpers -->
  <script id=""jf-builder-core"">
{builderCoreJs}
  </script>

  <!-- Custom Elements Definitions -->
  {string.Join("\n", scriptsList)}
</head>
<body>
  <div id=""jellycms-root"">
{bodyContent}
  </div>
  
  <script id=""jf-global-js"">
{globalSettings.GlobalJs}
  </script>
</body>
</html>";

            return html;
        }

        private string GetFormattedWidth(string widthVal)
        {
            if (string.IsNullOrEmpty(widthVal) || widthVal == "100%" || widthVal == "Auto") return "100%";
            if (widthVal == "50%") return "calc(50% - 8px)";
            if (widthVal == "33.3%") return "calc(33.3% - 11px)";
            if (widthVal == "25%") return "calc(25% - 12px)";
            if (widthVal == "75%") return "calc(75% - 4px)";
            if (widthVal == "66.6%") return "calc(66.6% - 6px)";
            return widthVal;
        }

        private string BuildResponsiveCss(List<BlockInstance> instances)
        {
            var desktopCss = new List<string>();
            var tabletCss = new List<string>();
            var mobileCss = new List<string>();

            foreach (var inst in instances)
            {
                var selector = $"#inst-{inst.Id}";

                var resp = inst.Responsive ?? new ResponsiveRules();

                var dRule = resp.Desktop ?? new DeviceStyles { Visible = true };
                var dStyles = new List<string>();
                dStyles.Add(dRule.Visible ? "display: block;" : "display: none;");
                if (!string.IsNullOrEmpty(dRule.Margin)) dStyles.Add($"margin: {dRule.Margin};");
                if (!string.IsNullOrEmpty(dRule.Padding)) dStyles.Add($"padding: {dRule.Padding};");
                if (!string.IsNullOrEmpty(dRule.Align)) dStyles.Add($"text-align: {dRule.Align};");
                if (!string.IsNullOrEmpty(dRule.Width)) dStyles.Add($"width: {GetFormattedWidth(dRule.Width)};");
                desktopCss.Add($"{selector} {{ {string.Join(" ", dStyles)} }}");

                var tRule = resp.Tablet ?? new DeviceStyles { Visible = true };
                var tStyles = new List<string>();
                tStyles.Add(tRule.Visible ? "display: block !important;" : "display: none !important;");
                if (!string.IsNullOrEmpty(tRule.Margin)) tStyles.Add($"margin: {tRule.Margin} !important;");
                if (!string.IsNullOrEmpty(tRule.Padding)) tStyles.Add($"padding: {tRule.Padding} !important;");
                if (!string.IsNullOrEmpty(tRule.Align)) tStyles.Add($"text-align: {tRule.Align} !important;");
                if (!string.IsNullOrEmpty(tRule.Width)) tStyles.Add($"width: {GetFormattedWidth(tRule.Width)} !important;");
                tabletCss.Add($"{selector} {{ {string.Join(" ", tStyles)} }}");

                var mRule = resp.Mobile ?? new DeviceStyles { Visible = true };
                var mStyles = new List<string>();
                mStyles.Add(mRule.Visible ? "display: block !important;" : "display: none !important;");
                if (!string.IsNullOrEmpty(mRule.Margin)) mStyles.Add($"margin: {mRule.Margin} !important;");
                if (!string.IsNullOrEmpty(mRule.Padding)) mStyles.Add($"padding: {mRule.Padding} !important;");
                if (!string.IsNullOrEmpty(mRule.Align)) mStyles.Add($"text-align: {mRule.Align} !important;");
                if (!string.IsNullOrEmpty(mRule.Width)) mStyles.Add($"width: {GetFormattedWidth(mRule.Width)} !important;");
                mobileCss.Add($"{selector} {{ {string.Join(" ", mStyles)} }}");
            }

            var responsiveStyles = string.Join("\n", desktopCss) + "\n\n" +
                                   "@media (min-width: 768px) and (max-width: 1024px) {\n" +
                                   string.Join("\n  ", tabletCss) + "\n" +
                                   "}\n\n" +
                                   "@media (max-width: 767px) {\n" +
                                   string.Join("\n  ", mobileCss) + "\n" +
                                   "}";

            return responsiveStyles;
        }
    }

    public class BlockInstance
    {
        public string Id { get; set; } = string.Empty;
        public string BlockId { get; set; } = string.Empty;
        public Dictionary<string, object> Settings { get; set; } = new Dictionary<string, object>();
        public ResponsiveRules? Responsive { get; set; }
    }

    public class ResponsiveRules
    {
        public DeviceStyles? Desktop { get; set; }
        public DeviceStyles? Tablet { get; set; }
        public DeviceStyles? Mobile { get; set; }
    }

    public class DeviceStyles
    {
        public bool Visible { get; set; } = true;
        public string? Margin { get; set; }
        public string? Padding { get; set; }
        public string? Align { get; set; }
        public string? Width { get; set; }
    }
}
