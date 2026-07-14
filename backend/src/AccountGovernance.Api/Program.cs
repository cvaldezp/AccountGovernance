using System.Reflection;
using System.Text.Json;
using AccountGovernance.Api.Middleware;
using AccountGovernance.Api.Services;
using AccountGovernance.Application;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Infrastructure;
using AccountGovernance.Infrastructure.Persistence;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Data.SqlClient;
using Microsoft.Identity.Web;
using Microsoft.OpenApi.Models;
using Serilog;

// ── Bootstrap Serilog early so startup errors are captured ───────────────────
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // ── Logging ───────────────────────────────────────────────────────────────
    builder.Host.UseSerilog((ctx, cfg) =>
        cfg.ReadFrom.Configuration(ctx.Configuration)
           .Enrich.FromLogContext());

    // ── Authentication — Microsoft Entra ID (Azure AD) ────────────────────────
    builder.Services
        .AddAuthentication()
        .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

    // ── Services ──────────────────────────────────────────────────────────────
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();

    // Liveness only — no registered checks, so it never touches AD or the database.
    // Readiness (AD/DB connectivity) is a separate concern, not implemented here.
    builder.Services.AddHealthChecks();

    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo
        {
            Title       = "AccountGovernance API",
            Version     = "v1",
            Description = "Active Directory governance portal — user lookup, permissions, and audit.",
        });

        // JWT Bearer support for Swagger UI
        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Type         = SecuritySchemeType.Http,
            Scheme       = "bearer",
            BearerFormat = "JWT",
            Description  = "Pega un access_token de Entra ID. Obtenerlo con: az account get-access-token --resource api://<clientId>",
        });
        c.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id   = "Bearer",
                    },
                },
                Array.Empty<string>()
            }
        });

        var xml = Path.Combine(AppContext.BaseDirectory,
            $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
        if (File.Exists(xml))
            c.IncludeXmlComments(xml);
    });

    builder.Services.AddApplication();
    builder.Services.AddInfrastructure(builder.Configuration);

    builder.Services.AddCors(opt => opt.AddPolicy("Frontend", policy =>
        policy
            .WithOrigins(
                builder.Configuration.GetSection("Cors:AllowedOrigins")
                    .Get<string[]>() ?? ["http://localhost:5173"])
            .AllowAnyHeader()
            .AllowAnyMethod()));

    // ── Pipeline ──────────────────────────────────────────────────────────────
    var app = builder.Build();

    app.UseMiddleware<ExceptionHandlingMiddleware>();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        // Relative path (no leading slash) — resolves against the current PathBase in the
        // browser (e.g. /api/swagger/v1/swagger.json when hosted as an IIS child app at
        // /api). An absolute path would ignore PathBase and 404 under IIS.
        app.UseSwaggerUI(c =>
            c.SwaggerEndpoint("v1/swagger.json", "AccountGovernance API v1"));
    }

    app.UseSerilogRequestLogging();
    app.UseCors("Frontend");
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();

    // Liveness endpoint for HAProxy — anonymous, no AD/DB access.
    app.MapHealthChecks("/health", new HealthCheckOptions
    {
        ResponseWriter = async (context, report) =>
        {
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(
                JsonSerializer.Serialize(new { status = report.Status.ToString() }));
        },
    }).AllowAnonymous();

    // TEMP LOG — remove once the SQL Server/DB target for this IIS deployment is confirmed.
    // Runs once at startup, never per-request. Reads the exact connection string
    // IDbConnectionFactory would use (the connection is never opened), and logs only
    // non-secret pieces via SqlConnectionStringBuilder — never the password, the raw
    // connection string, or any token/secret.
    using (var conn = app.Services.GetRequiredService<IDbConnectionFactory>().Create())
    {
        var csb = new SqlConnectionStringBuilder(conn.ConnectionString);
        Log.Information("[DB-CONFIG] Environment={Env}",     app.Environment.EnvironmentName);
        Log.Information("[DB-CONFIG] Server={Server}",       csb.DataSource);
        Log.Information("[DB-CONFIG] Database={Database}",   csb.InitialCatalog);
        Log.Information("[DB-CONFIG] ContentRoot={Content}",  app.Environment.ContentRootPath);
    }

    Log.Information("Starting AccountGovernance API on {Env}", app.Environment.EnvironmentName);
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
