import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import {
  InsufficientFundsError,
  WalletAlreadyExistsError,
  WalletNotFoundError,
} from "../../domain/wallet/wallet.errors";
import { InvalidMoneyAmountError } from "../../domain/shared/money.vo";
import { InvalidPlayerIdError } from "../../domain/shared/player-id.vo";

const STATUS_MAP = new Map<Function, HttpStatus>([
  [WalletAlreadyExistsError, HttpStatus.CONFLICT],
  [WalletNotFoundError, HttpStatus.NOT_FOUND],
  [InsufficientFundsError, HttpStatus.CONFLICT],
  [InvalidMoneyAmountError, HttpStatus.BAD_REQUEST],
  [InvalidPlayerIdError, HttpStatus.BAD_REQUEST],
]);

@Catch(
  WalletAlreadyExistsError,
  WalletNotFoundError,
  InsufficientFundsError,
  InvalidMoneyAmountError,
  InvalidPlayerIdError,
)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host
      .switchToHttp()
      .getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const status = STATUS_MAP.get(exception.constructor) ?? HttpStatus.BAD_REQUEST;
    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
    });
  }
}
