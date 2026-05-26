using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace JellyCMS.Services
{
    public class BlockInfo
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public string SchemaJson { get; set; } = "{}";
        public bool IsBuiltIn { get; set; }
    }

    public class BlockManager
    {
        private readonly IApplicationPaths _appPaths;
        private readonly ILogger<BlockManager> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _blocksDirectory;

        public BlockManager(IApplicationPaths appPaths, ILogger<BlockManager> logger, IHttpClientFactory httpClientFactory)
        {
            _appPaths = appPaths;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            
            _blocksDirectory = Path.Combine(appPaths.DataPath, "jellycms-blocks");
            Directory.CreateDirectory(_blocksDirectory);

            try
            {
                ExtractBuiltInBlocks();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JellyCMS: Failed to extract built-in blocks on startup.");
            }
        }

        public string GetBlocksDirectory() => _blocksDirectory;

        public List<BlockInfo> GetInstalledBlocks()
        {
            var blocks = new List<BlockInfo>();
            if (!Directory.Exists(_blocksDirectory)) return blocks;

            foreach (var dir in Directory.GetDirectories(_blocksDirectory))
            {
                var blockId = Path.GetFileName(dir);
                var schemaPath = Path.Combine(dir, "schema.json");

                if (!File.Exists(schemaPath)) continue;

                try
                {
                    var schemaJson = File.ReadAllText(schemaPath);
                    using var doc = JsonDocument.Parse(schemaJson);
                    var root = doc.RootElement;

                    var name = root.TryGetProperty("name", out var n) ? n.GetString() ?? blockId : blockId;
                    var category = root.TryGetProperty("category", out var c) ? c.GetString() ?? "General" : "General";
                    var icon = root.TryGetProperty("icon", out var i) ? i.GetString() ?? "widgets" : "widgets";

                    var isBuiltIn = blockId == "hero-banner" || blockId == "media-grid" || blockId == "user-card" ||
                                    blockId == "slider-carousel" || blockId == "feature-cards" || blockId == "cta-banner" ||
                                    blockId == "top-watched" || blockId == "custom-html" ||
                                    blockId == "now-playing" || blockId == "jelly-ai" || blockId == "overseerr-requests" ||
                                    blockId == "recently-added" || blockId == "next-up" || blockId == "server-health" || blockId == "live-tv-guide" ||
                                    blockId == "playback-stats" || blockId == "user-achievements" || blockId == "recommendation-roulette" ||
                                    blockId == "download-queue" || blockId == "subtitle-requests" || blockId == "overseerr-approvals" ||
                                    blockId == "upcoming-releases" || blockId == "buffering-speedtest" || blockId == "music-player" ||
                                    blockId == "server-announcements" || blockId == "weather-dashboard" || blockId == "letterboxd-sync";

                    blocks.Add(new BlockInfo
                    {
                        Id = blockId,
                        Name = name,
                        Category = category,
                        Icon = icon,
                        SchemaJson = schemaJson,
                        IsBuiltIn = isBuiltIn
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "JellyCMS: Error parsing block schema at {Path}", schemaPath);
                }
            }

            return blocks;
        }

        public void UninstallBlock(string blockId)
        {
            var blockDir = Path.Combine(_blocksDirectory, blockId);
            if (Directory.Exists(blockDir))
            {
                Directory.Delete(blockDir, true);
                _logger.LogInformation("JellyCMS: Successfully uninstalled block {BlockId}", blockId);
            }
            else
            {
                throw new DirectoryNotFoundException($"Block {blockId} is not installed.");
            }
        }

        public async Task InstallBlockFromZipAsync(string blockId, string zipUrl)
        {
            _logger.LogInformation("JellyCMS: Starting download of block {BlockId} from {Url}", blockId, zipUrl);
            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync(zipUrl);
            response.EnsureSuccessStatusCode();

            using var zipStream = await response.Content.ReadAsStreamAsync();
            using var archive = new ZipArchive(zipStream);

            var tempExtractDir = Path.Combine(Path.GetTempPath(), "jellycms-extract-" + Guid.NewGuid());
            Directory.CreateDirectory(tempExtractDir);

            try
            {
                var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    ".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"
                };

                foreach (var entry in archive.Entries)
                {
                    if (string.IsNullOrEmpty(entry.Name)) continue;

                    var destinationPath = Path.GetFullPath(Path.Combine(tempExtractDir, entry.FullName));
                    if (!destinationPath.StartsWith(tempExtractDir, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException("JellyCMS: Directory traversal attempt detected: " + entry.FullName);
                    }

                    var extension = Path.GetExtension(entry.FullName);
                    if (!allowedExtensions.Contains(extension) && !string.IsNullOrEmpty(extension))
                    {
                        throw new InvalidOperationException("JellyCMS: Disallowed file extension: " + extension);
                    }

                    var entryDir = Path.GetDirectoryName(destinationPath);
                    if (entryDir != null) Directory.CreateDirectory(entryDir);

                    entry.ExtractToFile(destinationPath, true);
                }

                var sourcePath = tempExtractDir;
                var files = Directory.GetFiles(tempExtractDir, "schema.json", SearchOption.AllDirectories);
                if (files.Length > 0)
                {
                    sourcePath = Path.GetDirectoryName(files[0])!;
                }
                else
                {
                    throw new InvalidOperationException("JellyCMS: Block package missing required schema.json file.");
                }

                var finalDestDir = Path.Combine(_blocksDirectory, blockId);
                if (Directory.Exists(finalDestDir)) Directory.Delete(finalDestDir, true);
                Directory.CreateDirectory(finalDestDir);

                foreach (var filePath in Directory.GetFiles(sourcePath))
                {
                    var fileName = Path.GetFileName(filePath);
                    File.Copy(filePath, Path.Combine(finalDestDir, fileName), true);
                }
                
                _logger.LogInformation("JellyCMS: Installed block {BlockId} successfully.", blockId);
            }
            finally
            {
                if (Directory.Exists(tempExtractDir)) Directory.Delete(tempExtractDir, true);
            }
        }

        private void ExtractBuiltInBlocks()
        {
            var assembly = typeof(BlockManager).Assembly;
            var resourcePrefix = "JellyCMS.Web.Blocks.";
            var resourceNames = assembly.GetManifestResourceNames()
                .Where(name => name.StartsWith(resourcePrefix, StringComparison.OrdinalIgnoreCase))
                .ToList();

            var suffixes = new[] { ".schema.json", ".template.html", ".style.css", ".element.js" };

            foreach (var resourceName in resourceNames)
            {
                var suffix = suffixes.FirstOrDefault(s => resourceName.EndsWith(s, StringComparison.OrdinalIgnoreCase));
                if (suffix == null) continue;

                var relativeName = resourceName.Substring(resourcePrefix.Length);
                var blockId = relativeName.Substring(0, relativeName.Length - suffix.Length);

                blockId = blockId.Replace('_', '-');

                var fileName = suffix.TrimStart('.');

                var blockDir = Path.Combine(_blocksDirectory, blockId);
                Directory.CreateDirectory(blockDir);

                var destPath = Path.Combine(blockDir, fileName);

                using var stream = assembly.GetManifestResourceStream(resourceName);
                if (stream != null)
                {
                    using var fileStream = new FileStream(destPath, FileMode.Create, FileAccess.Write);
                    stream.CopyTo(fileStream);
                }
            }
        }
    }
}
