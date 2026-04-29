package app.locksmith;

public final class LocksmithException extends Exception {
  public final String code;
  public final int status;

  public LocksmithException(String code, String message, int status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
