using System;

namespace JellyCMS.Database
{
    public class PageEntity
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string LayoutSchema { get; set; } = "[]";
        public bool IsDraft { get; set; } = true;
        public string SeoMetadata { get; set; } = "{}";
    }

    public class GlobalSettingEntity
    {
        public int Id { get; set; } = 1;
        public string GlobalHeadHtml { get; set; } = string.Empty;
        public string GlobalCss { get; set; } = string.Empty;
        public string GlobalJs { get; set; } = string.Empty;
    }

    public class RepositoryEntity
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ManifestUrl { get; set; } = string.Empty;
        public DateTime LastSynced { get; set; }
    }
}
