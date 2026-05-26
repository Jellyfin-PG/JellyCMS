using System;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace JellyCMS.Controllers
{
    [ApiController]
    public class CmsResourceController : ControllerBase
    {
        private readonly ILogger<CmsResourceController> _logger;

        public CmsResourceController(ILogger<CmsResourceController> logger)
        {
            _logger = logger;
        }

        [HttpGet("/cms/assets/cms_admin.css")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public IActionResult GetCmsAdminCss()
        {
            return ServeEmbeddedAsset("cms_admin.css", "text/css");
        }

        [HttpGet("/cms/assets/cms_admin.js")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public IActionResult GetCmsAdminJs()
        {
            return ServeEmbeddedAsset("cms_admin.js", "application/javascript");
        }

        [HttpGet("/cms/assets/builder-core.js")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public IActionResult GetBuilderCoreJs()
        {
            return ServeEmbeddedAsset("builder-core.js", "application/javascript");
        }

        [HttpGet("/cms/admin/editor")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async System.Threading.Tasks.Task<IActionResult> GetCmsAdminHtml()
        {
            var assembly = typeof(CmsResourceController).Assembly;
            var resourceName = assembly.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("cms_admin.html", StringComparison.OrdinalIgnoreCase));

            if (resourceName == null) return NotFound();

            using var stream = assembly.GetManifestResourceStream(resourceName);
            if (stream == null) return NotFound();

            using var reader = new System.IO.StreamReader(stream);
            var rawHtml = await reader.ReadToEndAsync();

            var documentWrapper = $@"<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>JellyCMS Studio</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #08090d;
      color: #e2e8f0;
    }}
  </style>
  <script src=""/cms/assets/builder-core.js""></script>
</head>
<body>
  {rawHtml}
</body>
</html>";

            return Content(documentWrapper, "text/html");
        }

        private IActionResult ServeEmbeddedAsset(string filename, string contentType)
        {
            var assembly = typeof(CmsResourceController).Assembly;
            var resourceName = assembly.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith(filename, StringComparison.OrdinalIgnoreCase));

            if (resourceName == null)
            {
                _logger.LogError("JellyCMS: Embedded resource {Filename} not found.", filename);
                return NotFound();
            }

            var stream = assembly.GetManifestResourceStream(resourceName);
            if (stream == null)
            {
                _logger.LogError("JellyCMS: Could not open stream for embedded resource {Name}", resourceName);
                return NotFound();
            }

            return File(stream, contentType);
        }
    }
}
