import SectionCard from './SectionCard.jsx'
import {
  AddIcon,
  AiGuide,
  AutoConnectIcon,
  InstructionIcon,
  CheckIcon,
  PrintIcon,
  ResetIcon,
  TableIcon,
} from './Icons.jsx'

const STEPS = {
  CONNECT: 2,
  CHECK: 3,
}

const buttons = [
  {
    id: 'instruction-button',
    label: 'INSTRUCTIONS',
    tone: 'action-button--brown',
    Icon: InstructionIcon,
    handlerName: 'onInstruction',
    targetId: 'instruction-button-walkthrough-target',
    activeStep: null,
  },
  {
    id: 'ai-guide-button',
    label: 'AI GUIDE',
    tone: 'action-button--cyan',
    Icon: AiGuide,
    handlerName: 'onAiGuide',
    targetId: 'ai-guide-button-walkthrough-target',
    activeStep: null,
  },
  {
    id: 'check-button',
    label: 'CHECK',
    tone: 'action-button--green',
    Icon: CheckIcon,
    handlerName: 'onCheck',
    targetId: 'check-button-walkthrough-target',
    activeStep: STEPS.CHECK,
  },
  {
    id: 'auto-connect-button',
    label: 'AUTO CONNECT',
    tone: 'action-button--teal',
    Icon: AutoConnectIcon,
    handlerName: 'onAutoConnect',
    targetId: 'auto-connect-button-walkthrough-target',
    activeStep: STEPS.CONNECT,
  },
  {
    id: 'add-reading-button',
    label: 'ADD',
    tone: 'action-button--blue',
    Icon: AddIcon,
    handlerName: 'onAdd',
    targetId: 'add-button-walkthrough-target',
    activeStep: null,
  },
  {
    id: 'reset-button',
    label: 'RESET',
    tone: 'action-button--red',
    Icon: ResetIcon,
    handlerName: 'onReset',
    targetId: 'reset-button-walkthrough-target',
    activeStep: null,
  },
  {
    id: 'print-button',
    label: 'PRINT',
    tone: 'action-button--purple',
    Icon: PrintIcon,
    handlerName: 'onPrint',
    targetId: 'print-button-walkthrough-target',
    activeStep: null,
  },
  {
    id: 'correct-values-button',
    label: 'CORRECT VALUES',
    tone: 'action-button--orange',
    Icon: TableIcon,
    handlerName: 'onCorrectValues',
    targetId: 'correct-values-button-walkthrough-target',
    activeStep: null,
  },
]

const ActionButtons = ({
  disabledButtons = {},
  onAdd,
  onAiGuide,
  onCheck,
  onInstruction,
  onPrint,
  onReset,
  onAutoConnect,
  onCorrectValues,
  correctValuesOpen = false,
  aiGuideActive = false,
  currentStep = 1,
}) => {
  const handlers = {
    onAdd,
    onAiGuide,
    onCheck,
    onInstruction,
    onPrint,
    onReset,
    onAutoConnect,
    onCorrectValues,
  }

  const isButtonHighlighted = (activeStep, handlerName) => {
    if (!activeStep) return false
    if (handlerName === 'onAutoConnect' && currentStep === STEPS.CONNECT) return true
    if (handlerName === 'onCheck' && currentStep === STEPS.CHECK) return true
    return activeStep === currentStep
  }

  return (
    <SectionCard className="h-[176px]" icon="buttons" id="action-buttons-panel" title="ACTION BUTTONS">
      <div className="action-buttons__grid">
        {buttons.map(({ id, label, tone, Icon, handlerName, targetId, activeStep }) => {
          const handler = handlers[handlerName]
          const isDisabled = handlerName === 'onAiGuide'
            ? false
            : !handler || disabledButtons[handlerName]
          const isHighlighted = isButtonHighlighted(activeStep, handlerName)
          const isAiGuideButton = handlerName === 'onAiGuide'
          const isCorrectValuesButton = handlerName === 'onCorrectValues'

          return (
            <div className={`action-button-wrapper-box ${isHighlighted ? 'action-button--highlighted' : ''}`} key={label}>
              <button
                id={id}
                type="button"
                aria-pressed={isAiGuideButton ? aiGuideActive : undefined}
                aria-expanded={isCorrectValuesButton ? correctValuesOpen : undefined}
                aria-controls={isCorrectValuesButton ? 'correct-values-panel' : undefined}
                className={`action-button ${tone} ${isHighlighted ? 'action-button--pulse' : ''} ${isAiGuideButton && aiGuideActive ? 'action-button--ai-active' : ''}`}
                disabled={isDisabled}
                onClick={handler}
                title={isAiGuideButton
                  ? `AI Guide is ${aiGuideActive ? 'ON — click to turn it off' : 'OFF — click to turn it on'}`
                  : isCorrectValuesButton
                    ? isDisabled ? 'Available after an unsuccessful verification.' : 'Show or hide the correct values table.'
                    : undefined}
              >
                <Icon />
                <span>{label}</span>
              </button>
              <span className="action-button-walkthrough-target" id={targetId} aria-hidden="true" />
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

export default ActionButtons
