import { _decorator, Component, Node } from 'cc';
// GameViewModel.ts
import { ViewModel, observable, command, viewModel, throttle, computed } from '@esengine/mvvm-ui-framework';
const { ccclass, property } = _decorator;

@viewModel
export class GameViewModel extends ViewModel {
    @observable
    public playerAlive: boolean = true;
    @observable
    public playerDamage: number = 0;
    @observable
    public playerDistance: number = 0;

    public scoreMax: number = 5;

    public get name() { return 'GameViewModel'; }

    @observable
    public score: number = 0;

    @command()
    public addScore(): void {
        this.score += 1;
        this.playerAlive = this.score%2 == 0;
        console.log('score = ', this.score);
    }
    
    @computed(['score'])
    public get scoreFlag(): boolean {
        return this.score >= this.scoreMax;
    }

    @computed(['score'])
    public get scoreFlagNegate(): boolean {
        return this.score < this.scoreMax;
    }

    @command({ parameterized: true })
    public movePlayer(direction: string, distance: number): void {
        this.playerDistance += distance;
        // console.log(`玩家向${direction}累计移动${this.playerDistance}距离`);
    }

    @command({ parameterized: true, canExecuteMethod: 'canAttack' })
    @throttle(3000)
    public attackEnemy(enemyId: number, damage: number): void {
        this.playerDamage += damage;
        // console.log(`攻击敌人${enemyId}, 累计造成伤害 ${this.playerDamage}`);
    }

    public canAttack(enemyId: number, damage: number): boolean {
        return enemyId > 0 && damage > 0 && this.playerAlive;
    }

    @command()
    public onReadyGoFinished() {
        console.log("readyGo 动画结束，VM 收到事件");
    }
}


