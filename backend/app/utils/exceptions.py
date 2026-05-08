"""
Custom exception classes.

Design notes:
- `message` is the user-facing string. It MUST NOT include inner-exception
  text, IDs that aren't already known to the caller, or DB schema details.
- `cause` (optional) is the underlying exception, kept for server-side
  logging via `logger.exception(...)`. It is never echoed to clients.
- Routes should catch these and either re-raise as HTTPException with
  `detail=e.message` (already scrubbed) or substitute a generic string.
"""


class GrayFSMException(Exception):
    """Base exception for all GrayFSM errors."""

    def __init__(
        self,
        message: str,
        code: str = "GRAYFSM_ERROR",
        cause: BaseException | None = None,
    ):
        self.message = message
        self.code = code
        # Stored separately so callers and the global error handler can log
        # the underlying exception without it leaking into the response body.
        self.cause = cause
        super().__init__(self.message)


class FSMNotFoundException(GrayFSMException):
    """Raised when FSM is not found.

    The id is stored on the exception for server-side logging but is NOT
    included in the user-facing message — exposing it would let unauthenticated
    callers enumerate which IDs exist.
    """

    def __init__(self, fsm_id: str):
        self.fsm_id = fsm_id
        super().__init__(message="FSM not found", code="FSM_NOT_FOUND")


class FSMValidationException(GrayFSMException):
    """Raised when FSM validation fails"""

    def __init__(self, message: str):
        super().__init__(message=message, code="FSM_VALIDATION_ERROR")


class AlgorithmException(GrayFSMException):
    """Raised when algorithm execution fails.

    `message` should describe the failure category in stable, scrubbed
    language (e.g. "Algorithm execution failed"). Pass the underlying
    exception via `cause` for server-side logging.
    """

    def __init__(self, message: str, cause: BaseException | None = None):
        super().__init__(message=message, code="ALGORITHM_ERROR", cause=cause)


class ExportException(GrayFSMException):
    """Raised when export generation fails.

    See AlgorithmException for the message/cause contract. The message
    must not concatenate `str(inner_exception)` — that's exactly what the
    `cause` parameter is for.
    """

    def __init__(self, message: str, cause: BaseException | None = None):
        super().__init__(message=message, code="EXPORT_ERROR", cause=cause)


class RateLimitException(GrayFSMException):
    """Raised when rate limit is exceeded"""

    def __init__(self, limit: int, window: int):
        super().__init__(
            message=f"Rate limit exceeded: {limit} requests per {window} seconds",
            code="RATE_LIMIT_EXCEEDED",
        )


class UserAlreadyExistsException(GrayFSMException):
    """Raised when attempting to register with an existing email"""

    def __init__(self, message: str):
        super().__init__(message=message, code="USER_ALREADY_EXISTS")


class UserNotFoundException(GrayFSMException):
    """Raised when user is not found"""

    def __init__(self, message: str):
        super().__init__(message=message, code="USER_NOT_FOUND")


class InvalidCredentialsException(GrayFSMException):
    """Raised when authentication credentials are invalid"""

    def __init__(self, message: str):
        super().__init__(message=message, code="INVALID_CREDENTIALS")


class FSMPermissionException(GrayFSMException):
    """Raised when a user lacks permission for the requested operation.

    Routes should typically translate this to a 404 (not a 403) so callers
    cannot distinguish "exists but forbidden" from "does not exist".
    """

    def __init__(self, fsm_id: str):
        self.fsm_id = fsm_id
        super().__init__(message="Not found", code="FSM_PERMISSION_DENIED")
