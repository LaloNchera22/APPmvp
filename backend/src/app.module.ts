import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { BettingModule } from './modules/betting/betting.module';
// import { PaymentModule } from './modules/payment/payment.module';
// import { GameOracleModule } from './modules/game-oracle/game-oracle.module';
// import { SharedModule } from './modules/shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // SharedModule,
    // PaymentModule,
    // GameOracleModule,
    // BettingModule,
  ],
})
export class AppModule {}
