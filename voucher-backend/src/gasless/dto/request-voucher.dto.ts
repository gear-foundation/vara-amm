import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RequestVoucherDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(66) // 0x + 64 hex chars (Vara address)
  account: string;

  /**
   * One or more program addresses to register on the voucher. For the AMM
   * onboarding path this should be the vUSDT token, vUSDT/VARA pair, and
   * native VARA exchange program in one request.
   *
   * Cap of 10 leaves room for route changes without opening an unlimited
   * whitelist append surface.
   *
   * Technically optional at the DTO layer so the service can emit a specific
   * migration hint when a legacy caller sends only the old `program` field.
   * The service enforces "must be a non-empty array if present" at request
   * time. Shape validation (@IsArray, @IsString each) ALWAYS runs so a
   * malformed payload like `programs: 123` returns a structured 400 from
   * class-validator instead of crashing in the service.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(66, { each: true })
  programs?: string[];

  /**
   * DEPRECATED: legacy `{ account, program: string }` shape. Accepted only so
   * the service can emit a specific migration error instead of the generic
   * "programs must be an array" from class-validator. Will be removed after
   * skills migration (task #15) lands.
   */
  @IsOptional()
  @IsString()
  @MaxLength(66)
  program?: string;
}
