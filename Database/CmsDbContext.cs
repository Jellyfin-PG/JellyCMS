using System.Linq;
using Microsoft.EntityFrameworkCore;

namespace JellyCMS.Database
{
    public class CmsDbContext : DbContext
    {
        public DbSet<PageEntity> Pages => Set<PageEntity>();
        public DbSet<GlobalSettingEntity> GlobalSettings => Set<GlobalSettingEntity>();
        public DbSet<RepositoryEntity> Repositories => Set<RepositoryEntity>();

        private readonly string _dbPath;
        private static bool _dbInitialized = false;
        private static readonly object _dbLock = new object();

        public CmsDbContext(string dbPath)
        {
            _dbPath = dbPath;
            
            if (!_dbInitialized)
            {
                lock (_dbLock)
                {
                    if (!_dbInitialized)
                    {
                        Database.EnsureCreated();

                        if (!GlobalSettings.Any())
                        {
                            GlobalSettings.Add(new GlobalSettingEntity
                            {
                                Id = 1,
                                GlobalHeadHtml = "<!-- JellyCMS Head -->",
                                GlobalCss = "/* JellyCMS Global Styles */\nbody {\n  margin: 0;\n  font-family: 'Outfit', sans-serif;\n  background-color: #0b0c10;\n  color: #c5c6c7;\n}",
                                GlobalJs = "// JellyCMS Global Scripts\nconsole.log('JellyCMS Initialized');"
                            });
                            SaveChanges();
                        }
                        
                        _dbInitialized = true;
                    }
                }
            }
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlite($"Data Source={_dbPath}");
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<PageEntity>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.Slug).IsUnique();
            });

            modelBuilder.Entity<GlobalSettingEntity>(entity =>
            {
                entity.HasKey(e => e.Id);
            });

            modelBuilder.Entity<RepositoryEntity>(entity =>
            {
                entity.HasKey(e => e.Id);
            });
        }
    }
}
