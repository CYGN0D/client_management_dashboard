<?php
/**
 * CLIENTO - SERVER-SIDE INPUT VALIDATION
 * Robust sanitization and field constraints.
 */

class Validator {
    private array $errors = [];

    public function requireString(array $data, string $field, string $label, int $minLength = 1, int $maxLength = 255): self {
        $val = trim($data[$field] ?? '');
        if ($val === '') {
            $this->errors[$field] = "{$label} is required.";
        } elseif (mb_strlen($val) < $minLength) {
            $this->errors[$field] = "{$label} must be at least {$minLength} character(s).";
        } elseif (mb_strlen($val) > $maxLength) {
            $this->errors[$field] = "{$label} cannot exceed {$maxLength} characters.";
        }
        return $this;
    }

    public function optionalString(array $data, string $field, string $label, int $maxLength = 255): self {
        if (!isset($data[$field]) || $data[$field] === '') {
            return $this;
        }
        $val = trim((string)$data[$field]);
        if (mb_strlen($val) > $maxLength) {
            $this->errors[$field] = "{$label} cannot exceed {$maxLength} characters.";
        }
        return $this;
    }

    public function email(array $data, string $field, string $label, bool $required = true): self {
        $val = trim($data[$field] ?? '');
        if ($val === '') {
            if ($required) {
                $this->errors[$field] = "{$label} is required.";
            }
            return $this;
        }

        if (!filter_var($val, FILTER_VALIDATE_EMAIL)) {
            $this->errors[$field] = "{$label} must be a valid email address.";
        }
        return $this;
    }

    public function positiveDecimal(array $data, string $field, string $label, bool $allowZero = false): self {
        if (!isset($data[$field]) || $data[$field] === '') {
            $this->errors[$field] = "{$label} is required.";
            return $this;
        }

        $val = $data[$field];
        if (!is_numeric($val)) {
            $this->errors[$field] = "{$label} must be a valid numeric amount.";
            return $this;
        }

        $num = (float)$val;
        if ($allowZero ? $num < 0 : $num <= 0) {
            $minLabel = $allowZero ? 'zero or greater' : 'greater than zero';
            $this->errors[$field] = "{$label} must be {$minLabel}.";
        }
        return $this;
    }

    public function date(array $data, string $field, string $label, bool $required = true): self {
        $val = trim($data[$field] ?? '');
        if ($val === '') {
            if ($required) {
                $this->errors[$field] = "{$label} is required.";
            }
            return $this;
        }

        $d = DateTime::createFromFormat('Y-m-d', $val);
        if (!$d || $d->format('Y-m-d') !== $val) {
            $this->errors[$field] = "{$label} must be in YYYY-MM-DD format.";
        }
        return $this;
    }

    public function month(array $data, string $field, string $label, bool $required = true): self {
        $val = trim($data[$field] ?? '');
        if ($val === '') {
            if ($required) {
                $this->errors[$field] = "{$label} is required.";
            }
            return $this;
        }

        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $val)) {
            $this->errors[$field] = "{$label} must be in YYYY-MM format.";
        }
        return $this;
    }

    public function intRange(array $data, string $field, string $label, int $min, int $max, bool $required = true): self {
        if (!isset($data[$field]) || $data[$field] === '') {
            if ($required) {
                $this->errors[$field] = "{$label} is required.";
            }
            return $this;
        }

        $val = filter_var($data[$field], FILTER_VALIDATE_INT);
        if ($val === false || $val < $min || $val > $max) {
            $this->errors[$field] = "{$label} must be an integer between {$min} and {$max}.";
        }
        return $this;
    }

    public function inEnum(array $data, string $field, string $label, array $allowed, bool $required = true): self {
        $val = $data[$field] ?? '';
        if ($val === '') {
            if ($required) {
                $this->errors[$field] = "{$label} is required.";
            }
            return $this;
        }

        if (!in_array($val, $allowed, true)) {
            $allowedList = implode(', ', $allowed);
            $this->errors[$field] = "{$label} must be one of: {$allowedList}.";
        }
        return $this;
    }

    public function hasErrors(): bool {
        return !empty($this->errors);
    }

    public function getErrors(): array {
        return $this->errors;
    }

    public static function getJsonInput(): array {
        $raw = file_get_contents('php://input');
        if (empty($raw)) {
            return [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function sanitize(string|null $val): string {
        if ($val === null) return '';
        return htmlspecialchars(trim($val), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
