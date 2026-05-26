using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using JellyCMS.Database;
using JellyCMS.Services;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace JellyCMS.Controllers
{
    [ApiController]
    public class CmsController : ControllerBase
    {
        private readonly CmsDbContext _dbContext;
        private readonly PageCompiler _pageCompiler;
        private readonly ILogger<CmsController> _logger;
        private readonly IUserManager _userManager;

        public CmsController(CmsDbContext dbContext, PageCompiler pageCompiler, ILogger<CmsController> logger, IUserManager userManager)
        {
            _dbContext = dbContext;
            _pageCompiler = pageCompiler;
            _logger = logger;
            _userManager = userManager;
        }

        [HttpGet("/CMS/{**slug}")]
        public async Task<IActionResult> ServePage([FromRoute] string slug)
        {
            if (string.IsNullOrEmpty(slug))
            {
                slug = "home";
            }

            var cleanSlug = slug.Trim('/').ToLowerInvariant();

            var page = await _dbContext.Pages
                .FirstOrDefaultAsync(p => p.Slug.ToLower() == cleanSlug);

            if (page == null)
            {
                _logger.LogWarning("JellyCMS: Request for non-existent slug: {Slug}", cleanSlug);
                return NotFound();
            }

            var authenticatedUserId = User.FindFirstValue("Jellyfin-UserId")
                                   ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                                   ?? string.Empty;

            var userName = string.Empty;
            var userImageTag = string.Empty;
            if (!string.IsNullOrEmpty(authenticatedUserId) && Guid.TryParse(authenticatedUserId, out var guid))
            {
                var user = _userManager.GetUserById(guid);
                if (user != null)
                {
                    userName = user.Username;
                }
            }

            var isAdmin = User.Claims.Any(c => c.Type == "Jellyfin-IsAdmin" && c.Value == "true") ||
                          User.IsInRole("Admin");

            if (page.IsDraft && !isAdmin)
            {
                _logger.LogWarning("JellyCMS: Guest attempted to access draft page: {Slug}", cleanSlug);
                return NotFound();
            }

            var apiToken = Request.Headers["X-MediaBrowser-Token"].ToString();
            if (string.IsNullOrEmpty(apiToken))
            {
                var authHeader = Request.Headers["Authorization"].ToString();
                if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("MediaBrowser Token=\""))
                {
                    apiToken = authHeader.Substring("MediaBrowser Token=\"".Length).TrimEnd('"');
                }
            }

            var settings = await _dbContext.GlobalSettings.FirstOrDefaultAsync(s => s.Id == 1)
                           ?? new GlobalSettingEntity();

            try
            {
                var compiledHtml = await _pageCompiler.CompilePageAsync(page, settings, apiToken, authenticatedUserId, userName, userImageTag);
                return Content(compiledHtml, "text/html");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JellyCMS: Error compiling page: {Slug}", cleanSlug);
                return StatusCode(500, "Error rendering page.");
            }
        }
    }
}
