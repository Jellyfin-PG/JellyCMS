using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using JellyCMS.Database;
using JellyCMS.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace JellyCMS.Controllers
{
    [ApiController]
    [Route("cms/admin")]
    [Authorize(Policy = "RequiresElevation")]
    public class CmsAdminController : ControllerBase
    {
        private readonly CmsDbContext _dbContext;
        private readonly BlockManager _blockManager;
        private readonly PageCompiler _pageCompiler;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<CmsAdminController> _logger;

        public CmsAdminController(
            CmsDbContext dbContext,
            BlockManager blockManager,
            PageCompiler pageCompiler,
            IHttpClientFactory httpClientFactory,
            ILogger<CmsAdminController> logger)
        {
            _dbContext = dbContext;
            _blockManager = blockManager;
            _pageCompiler = pageCompiler;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        [HttpGet("pages")]
        public async Task<IActionResult> GetPages()
        {

            var pages = await _dbContext.Pages.ToListAsync();
            return Ok(pages);
        }

        [HttpGet("pages/{id}")]
        public async Task<IActionResult> GetPage(Guid id)
        {

            var page = await _dbContext.Pages.FindAsync(id);
            if (page == null) return NotFound();
            return Ok(page);
        }

        [HttpPost("pages")]
        public async Task<IActionResult> SavePage([FromBody] PageSaveModel model)
        {


            if (string.IsNullOrEmpty(model.Title))
            {
                return BadRequest("Title is required.");
            }

            var cleanSlug = (model.Slug ?? string.Empty).Trim('/').ToLowerInvariant();
            if (string.IsNullOrEmpty(cleanSlug))
            {
                cleanSlug = "page-" + Guid.NewGuid().ToString().Substring(0, 8);
            }

            PageEntity? page;
            if (model.Id.HasValue && model.Id.Value != Guid.Empty)
            {
                page = await _dbContext.Pages.FindAsync(model.Id.Value);
                if (page == null)
                {
                    return NotFound("Page not found.");
                }

                var exists = await _dbContext.Pages.AnyAsync(p => p.Slug.ToLower() == cleanSlug && p.Id != page.Id);
                if (exists)
                {
                    return BadRequest("Slug is already in use by another page.");
                }

                _pageCompiler.EvictCache(page.Slug);

                page.Title = model.Title;
                page.Slug = cleanSlug;
                page.LayoutSchema = model.LayoutSchema ?? "[]";
                page.IsDraft = model.IsDraft;
                page.SeoMetadata = model.SeoMetadata ?? "{}";

                _dbContext.Pages.Update(page);
            }
            else
            {
                var exists = await _dbContext.Pages.AnyAsync(p => p.Slug.ToLower() == cleanSlug);
                if (exists)
                {
                    return BadRequest("Slug is already in use.");
                }

                page = new PageEntity
                {
                    Id = Guid.NewGuid(),
                    Title = model.Title,
                    Slug = cleanSlug,
                    LayoutSchema = model.LayoutSchema ?? "[]",
                    IsDraft = model.IsDraft,
                    SeoMetadata = model.SeoMetadata ?? "{}"
                };

                await _dbContext.Pages.AddAsync(page);
            }

            await _dbContext.SaveChangesAsync();

            _pageCompiler.EvictCache(cleanSlug);

            return Ok(page);
        }

        [HttpDelete("pages/{id}")]
        public async Task<IActionResult> DeletePage(Guid id)
        {

            var page = await _dbContext.Pages.FindAsync(id);
            if (page == null) return NotFound();

            _pageCompiler.EvictCache(page.Slug);

            _dbContext.Pages.Remove(page);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {

            var settings = await _dbContext.GlobalSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                settings = new GlobalSettingEntity
                {
                    Id = 1,
                    GlobalHeadHtml = "",
                    GlobalCss = "",
                    GlobalJs = ""
                };
                await _dbContext.GlobalSettings.AddAsync(settings);
                await _dbContext.SaveChangesAsync();
            }
            return Ok(settings);
        }

        [HttpPut("settings")]
        public async Task<IActionResult> SaveSettings([FromBody] SettingsSaveModel model)
        {

            var settings = await _dbContext.GlobalSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                settings = new GlobalSettingEntity { Id = 1 };
                await _dbContext.GlobalSettings.AddAsync(settings);
            }

            settings.GlobalHeadHtml = model.GlobalHeadHtml ?? string.Empty;
            settings.GlobalCss = model.GlobalCss ?? string.Empty;
            settings.GlobalJs = model.GlobalJs ?? string.Empty;

            _dbContext.GlobalSettings.Update(settings);
            await _dbContext.SaveChangesAsync();

            var pages = await _dbContext.Pages.ToListAsync();
            foreach (var page in pages)
            {
                _pageCompiler.EvictCache(page.Slug);
            }

            return Ok(settings);
        }

        [HttpGet("blocks")]
        public IActionResult GetBlocks()
        {

            return Ok(_blockManager.GetInstalledBlocks());
        }

        [HttpGet("blocks/assets")]
        public async Task<IActionResult> GetBlocksAssets()
        {
            var blocks = _blockManager.GetInstalledBlocks();
            var assets = new List<object>();
            var blocksDir = _blockManager.GetBlocksDirectory();

            foreach (var block in blocks)
            {
                var blockPath = Path.Combine(blocksDir, block.Id);
                if (!Directory.Exists(blockPath)) continue;

                var templatePath = Path.Combine(blockPath, "template.html");
                var stylePath = Path.Combine(blockPath, "style.css");
                var elementPath = Path.Combine(blockPath, "element.js");

                var styleContent = System.IO.File.Exists(stylePath) ? await System.IO.File.ReadAllTextAsync(stylePath) : string.Empty;
                var templateContent = System.IO.File.Exists(templatePath) ? await System.IO.File.ReadAllTextAsync(templatePath) : string.Empty;
                var elementContent = System.IO.File.Exists(elementPath) ? await System.IO.File.ReadAllTextAsync(elementPath) : string.Empty;

                var templateWrapper = $"<template id=\"tpl-jf-{block.Id}\">\n" +
                                      $"  <style>\n{styleContent}\n  </style>\n" +
                                      $"  {templateContent}\n" +
                                      $"</template>";

                assets.Add(new
                {
                    Id = block.Id,
                    Template = templateWrapper,
                    Script = elementContent
                });
            }

            return Ok(assets);
        }

        [HttpDelete("blocks/{id}")]
        public IActionResult UninstallBlock(string id)
        {

            try
            {
                _blockManager.UninstallBlock(id);
                return Ok(new { success = true });
            }
            catch (DirectoryNotFoundException)
            {
                return NotFound("Block is not installed.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JellyCMS: Failed to uninstall block {BlockId}", id);
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("marketplace")]
        public async Task<IActionResult> GetMarketplaceBlocks()
        {

            var repos = await _dbContext.Repositories.ToListAsync();
            var client = _httpClientFactory.CreateClient();
            var availableBlocks = new List<MarketplaceBlock>();

            foreach (var repo in repos)
            {
                try
                {
                    var response = await client.GetAsync(repo.ManifestUrl);
                    if (!response.IsSuccessStatusCode) continue;

                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("blocks", out var blocksProp) && blocksProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var b in blocksProp.EnumerateArray())
                        {
                            availableBlocks.Add(new MarketplaceBlock
                            {
                                Id = b.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                                Name = b.TryGetProperty("name", out var name) ? name.GetString() ?? string.Empty : string.Empty,
                                Version = b.TryGetProperty("version", out var version) ? version.GetString() ?? "1.0.0" : "1.0.0",
                                Description = b.TryGetProperty("description", out var desc) ? desc.GetString() ?? string.Empty : string.Empty,
                                Thumbnail = b.TryGetProperty("thumbnail", out var thumb) ? thumb.GetString() ?? string.Empty : string.Empty,
                                DownloadUrl = b.TryGetProperty("downloadUrl", out var dl) ? dl.GetString() ?? string.Empty : string.Empty,
                                RepoName = repo.Name
                            });
                        }
                    }

                    repo.LastSynced = DateTime.UtcNow;
                    _dbContext.Repositories.Update(repo);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "JellyCMS: Failed to sync repo: {Url}", repo.ManifestUrl);
                }
            }

            await _dbContext.SaveChangesAsync();
            return Ok(availableBlocks);
        }

        [HttpGet("marketplace/repositories")]
        public async Task<IActionResult> GetRepositories()
        {

            return Ok(await _dbContext.Repositories.ToListAsync());
        }

        [HttpPost("marketplace/repositories")]
        public async Task<IActionResult> AddRepository([FromBody] RepositorySaveModel model)
        {


            if (string.IsNullOrEmpty(model.Name) || string.IsNullOrEmpty(model.ManifestUrl))
            {
                return BadRequest("Name and ManifestUrl are required.");
            }

            var repo = new RepositoryEntity
            {
                Id = Guid.NewGuid(),
                Name = model.Name,
                ManifestUrl = model.ManifestUrl,
                LastSynced = DateTime.MinValue
            };

            await _dbContext.Repositories.AddAsync(repo);
            await _dbContext.SaveChangesAsync();

            return Ok(repo);
        }

        [HttpDelete("marketplace/repositories/{id}")]
        public async Task<IActionResult> DeleteRepository(Guid id)
        {

            var repo = await _dbContext.Repositories.FindAsync(id);
            if (repo == null) return NotFound();

            _dbContext.Repositories.Remove(repo);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [HttpPost("marketplace/install")]
        public async Task<IActionResult> InstallMarketplaceBlock([FromBody] InstallBlockModel model)
        {


            if (string.IsNullOrEmpty(model.BlockId) || string.IsNullOrEmpty(model.DownloadUrl))
            {
                return BadRequest("BlockId and DownloadUrl are required.");
            }

            try
            {
                await _blockManager.InstallBlockFromZipAsync(model.BlockId, model.DownloadUrl);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JellyCMS: Failed to install block {BlockId}", model.BlockId);
                return StatusCode(500, ex.Message);
            }
        }
    }

    public class PageSaveModel
    {
        public Guid? Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? LayoutSchema { get; set; }
        public bool IsDraft { get; set; }
        public string? SeoMetadata { get; set; }
    }

    public class SettingsSaveModel
    {
        public string? GlobalHeadHtml { get; set; }
        public string? GlobalCss { get; set; }
        public string? GlobalJs { get; set; }
    }

    public class RepositorySaveModel
    {
        public string Name { get; set; } = string.Empty;
        public string ManifestUrl { get; set; } = string.Empty;
    }

    public class InstallBlockModel
    {
        public string BlockId { get; set; } = string.Empty;
        public string DownloadUrl { get; set; } = string.Empty;
    }

    public class MarketplaceBlock
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Thumbnail { get; set; } = string.Empty;
        public string DownloadUrl { get; set; } = string.Empty;
        public string RepoName { get; set; } = string.Empty;
    }
}
