using System.Net;
using System.Text.Json;

namespace AccountGovernance.Api.Middleware;

public sealed class ExceptionHandlingMiddleware(
    RequestDelegate                    next,
    ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client disconnected — swallow silently
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteErrorAsync(context, ex);
        }
    }

    private static Task WriteErrorAsync(HttpContext ctx, Exception ex)
    {
        ctx.Response.ContentType = "application/json";
        ctx.Response.StatusCode  = (int)HttpStatusCode.InternalServerError;

        var isDev = ctx.RequestServices
            .GetRequiredService<IWebHostEnvironment>()
            .IsDevelopment();

        var body = JsonSerializer.Serialize(new
        {
            error  = "An unexpected error occurred.",
            code   = "INTERNAL_ERROR",
            detail = isDev ? ex.Message : null,   // hide detail in production
        });

        return ctx.Response.WriteAsync(body);
    }
}
