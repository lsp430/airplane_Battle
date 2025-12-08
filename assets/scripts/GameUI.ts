import { _decorator, Button, Component, Label, Node, Slider, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { GameViewModel } from './GameViewModel';
import { BindingMode, BindingType, DataBinding } from '@esengine/mvvm-ui-framework';
const { ccclass, property } = _decorator;

@ccclass('GameUI')
export class GameUI extends Component {
    @property(Label)
    scoreLable: Label = null!;

    @property(Button)
    addButton: Button = null!;

    @property(Node)
    planeGame: Node = null!;

    @property(Node)
    showNode: Node = null!;

    @property(Node)
    readyGo: Node = null!;

    @property(Slider)
    slider: Slider = null!;

    @property(Node)
    spriteLight: Node = null!;

    private vm: GameViewModel;
    private dataBinding = DataBinding.getInstance();
    private readyGoAnim = false;

    start() {

    }

    update(deltaTime: number) {
        if (this.vm.scoreFlag && !this.readyGoAnim) {
            this.readyGoAnim = true;
            this.playReadyGoAnim();
        }
    }

    onLoad() {
        this.vm = new GameViewModel();

        // 1）单向绑定：score -> Label.string
        this.dataBinding.bind(this.vm, this.scoreLable as any, {
            type: BindingType.ONE_WAY, 
            mode: BindingMode.REPLACE, 
            source: 'score', 
            target: 'string'
        });

        // 2）按钮点击 -> 调用命令
        this.addButton.node.on(Button.EventType.CLICK, () => {
            console.log('click vm = ', this.vm);
            this.vm.executeCommand('addScore');
            this.vm.executeCommand('movePlayer', 'east', 100);
            this.vm.executeCommand('attackEnemy', 1, 10);
        });


        // 3）单向绑定
        this.dataBinding.bind(this.vm, this.planeGame as any, {
            type: BindingType.ONE_WAY, 
            mode: BindingMode.REPLACE, 
            source: 'scoreFlag', 
            target: 'active'
        });

        // 4）单向绑定
        this.dataBinding.bind(this.vm, this.showNode as any, {
            type: BindingType.ONE_WAY, 
            mode: BindingMode.REPLACE, 
            source: 'scoreFlagNegate', 
            target: 'active',
        });

        // 注册自定义转换器
        this.dataBinding.registerConverter('updateSlider', {
            convert: (score: number) => {
                const vm = this.vm;
                const maxScore = vm.scoreMax || 1;
                const p = score / maxScore;
                const _p = Math.max(0, Math.min(1, p));
                // console.log('slider 进度 = ', _p);
                this.spriteLight.getComponent(UITransform).width = this.slider.getComponent(UITransform).width * _p;
                return _p;
            },

            // ONE_WAY，可以不关心 convertBack，但签名要给一个函数
            convertBack: (progress: number) => {
                return progress;
            }
        });

        // 5）单向绑定
        this.dataBinding.bind(this.vm, this.slider as any, {
            type: BindingType.ONE_WAY,
            mode: BindingMode.REPLACE,
            source: 'score', 
            target: 'progress',
            converter: 'updateSlider',
        });

        this.dataBinding.bind(this.vm, this.readyGo as any, {
            type: BindingType.EVENT,
            mode: BindingMode.REPLACE,
            source: "readyGoFinished",
            target: "onReadyGoFinished",
        });

        this.readyGo.active = false;
    }

    playReadyGoAnim() {
        this.readyGo.active = true;
        tween(this.readyGo)
            .call(() => {
                this.readyGo.scale = new Vec3(0.2, 0.2, 0.2);
            })
            .by(0.8, { scale: new Vec3(0.8, 0.8, 0.8) })
            .call(() => {
                this.readyGo.active = false;
            })
            .start();
        tween(this.readyGo.getComponent(UIOpacity))
            .to(0.01, { opacity: 0 })
            .to(0.3, { opacity: 255 })
            .to(0.5, { opacity: 125 })
            .start();
    }
}


