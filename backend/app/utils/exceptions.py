"""
Custom exception classes
"""

class GrayFSMException(Exception):
    """Base exception for all GrayFSM errors"""
    def __init__(self, message: str, code: str = "GRAYFSM_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class FSMNotFoundException(GrayFSMException):
    """Raised when FSM is not found"""
    def __init__(self, fsm_id: str):
        super().__init__(
            message=f"FSM with ID '{fsm_id}' not found",
            code="FSM_NOT_FOUND"
        )


class FSMValidationException(GrayFSMException):
    """Raised when FSM validation fails"""
    def __init__(self, message: str):
        super().__init__(message=message, code="FSM_VALIDATION_ERROR")


class AlgorithmException(GrayFSMException):
    """Raised when algorithm execution fails"""
    def __init__(self, message: str):
        super().__init__(message=message, code="ALGORITHM_ERROR")


class ExportException(GrayFSMException):
    """Raised when export generation fails"""
    def __init__(self, message: str):
        super().__init__(message=message, code="EXPORT_ERROR")


class RateLimitException(GrayFSMException):
    """Raised when rate limit is exceeded"""
    def __init__(self, limit: int, window: int):
        super().__init__(
            message=f"Rate limit exceeded: {limit} requests per {window} seconds",
            code="RATE_LIMIT_EXCEEDED"
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
    """Raised when a user lacks permission to modify an FSM"""
    def __init__(self, fsm_id: str):
        super().__init__(
            message=f"You do not have permission to modify FSM '{fsm_id}'",
            code="FSM_PERMISSION_DENIED"
        )
