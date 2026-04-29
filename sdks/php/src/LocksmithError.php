<?php

declare(strict_types=1);

namespace Locksmith;

final class LocksmithError extends \Exception
{
    public function __construct(
        public readonly string $code,
        string $message,
        public readonly int $status,
    ) {
        parent::__construct($message);
    }
}
