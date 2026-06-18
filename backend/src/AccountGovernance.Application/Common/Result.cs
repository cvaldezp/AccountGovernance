namespace AccountGovernance.Application.Common;

/// <summary>Discriminated union for service return values — avoids exception-driven flow.</summary>
public sealed class Result<T>
{
    public bool    IsSuccess { get; }
    public T?      Data      { get; }
    public string? Error     { get; }
    public string? ErrorCode { get; }

    private Result(bool isSuccess, T? data, string? error, string? errorCode)
    {
        IsSuccess = isSuccess;
        Data      = data;
        Error     = error;
        ErrorCode = errorCode;
    }

    public static Result<T> Ok(T data)
        => new(true, data, null, null);

    public static Result<T> Fail(string error, string? errorCode = null)
        => new(false, default, error, errorCode);
}
