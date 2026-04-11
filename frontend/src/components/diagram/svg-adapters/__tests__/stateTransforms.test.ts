import { describe, expect, it } from 'vitest'
import {
  addSubstateInCode,
  addTransitionInCode,
  deleteStateInCode,
  deleteTransitionInCode,
  parseStateEdgeTarget,
  parseStateNodeTarget,
  renameStateInCode,
  setStateColorInCode,
  setTransitionActionInCode,
  setTransitionDestinationInCode,
  setTransitionGuardInCode,
  setTransitionTriggerInCode,
} from '../stateTransforms'

describe('stateTransforms', () => {
  it('parses state node metadata from the SVG anchor title', () => {
    expect(
      parseStateNodeTarget({
        rawId: 'CarTransmission_stateDrive_first',
        anchorTitle: 'Class CarTransmission, SM state, State drive.first',
      }),
    ).toEqual({
      rawId: 'CarTransmission_stateDrive_first',
      label: 'drive.first',
      stateName: 'first',
      isCluster: false,
    })
  })

  it('falls back to cluster ids when no SVG anchor title is available', () => {
    expect(
      parseStateNodeTarget({
        rawId: 'clusterPhone_screenLight_Off',
        anchorTitle: null,
      }),
    ).toEqual({
      rawId: 'clusterPhone_screenLight_Off',
      label: 'Phone_screenLight_Off',
      stateName: 'Off',
      isCluster: true,
    })
  })

  it('parses transition metadata from the SVG anchor title', () => {
    expect(
      parseStateEdgeTarget({
        rawId: 'CarTransmission_stateDrive_first->CarTransmission_stateDrive_second',
        anchorTitle: 'From drive.first to drive.second on reachSecondSpeed\rGuard: [driveSelected]',
      }),
    ).toEqual({
      rawId: 'CarTransmission_stateDrive_first->CarTransmission_stateDrive_second',
      sourceRawId: 'CarTransmission_stateDrive_first',
      targetRawId: 'CarTransmission_stateDrive_second',
      sourceLabel: 'drive.first',
      targetLabel: 'drive.second',
      trigger: 'reachSecondSpeed',
      guard: '[driveSelected]',
      action: null,
    })
  })

  it('renames a state only within its owning state machine', () => {
    const code = `class Phone {
  ringerSound {
    Off {
      callReceived -> On;
    }

    On {
      silentButton -> Off;
    }
  }

  screenLight {
    Off {
      callReceived -> On;
    }

    On {
      hangUp -> Off;
    }
  }
}
`

    const next = renameStateInCode(
      code,
      {
        rawId: 'Phone_screenLight_Off',
        anchorTitle: 'Class Phone, SM state, State screenLight.Off',
      },
      'Dark',
    )

    expect(next).toBe(`class Phone {
  ringerSound {
    Off {
      callReceived -> On;
    }

    On {
      silentButton -> Off;
    }
  }

  screenLight {
    Dark {
      callReceived -> On;
    }

    On {
      hangUp -> Dark;
    }
  }
}
`)
  })

  it('deletes a state block and incoming transitions in the same state machine', () => {
    const code = `class Phone {
  ringerSound {
    Off {
      callReceived -> On;
    }

    On {
      silentButton -> Off;
    }
  }

  screenLight {
    Off {
      callReceived -> On;
    }

    On {
      hangUp -> Off;
    }
  }
}
`

    const next = deleteStateInCode(code, {
      rawId: 'Phone_screenLight_Off',
      anchorTitle: 'Class Phone, SM state, State screenLight.Off',
    })

    expect(next).toBe(`class Phone {
  ringerSound {
    Off {
      callReceived -> On;
    }

    On {
      silentButton -> Off;
    }
  }

  screenLight {
    On {
    }
  }
}
`)
  })

  it('adds a substate at the end of the target state block', () => {
    const code = `class CarTransmission {
  state {
    drive {
      first {
      }
    }
  }
}
`

    const next = addSubstateInCode(code, {
      rawId: 'clusterCarTransmission_state_drive',
      anchorTitle: null,
    }, 'second')

    expect(next).toBe(`class CarTransmission {
  state {
    drive {
      first {
      }
      second {
      }
    }
  }
}
`)
  })

  it('adds or replaces displayColor within a state block', () => {
    const withoutColor = `class PhoneLine {
  state {
    onHold {
    }
  }
}
`

    expect(
      setStateColorInCode(withoutColor, {
        rawId: 'PhoneLine_state_onHold',
        anchorTitle: 'Class PhoneLine, SM state, State onHold',
      }, '#ff0000'),
    ).toBe(`class PhoneLine {
  state {
    onHold {
      displayColor #ff0000;
    }
  }
}
`)

    const withColor = `class PhoneLine {
  state {
    onHold {
      displayColor #00ff00;
    }
  }
}
`

    expect(
      setStateColorInCode(withColor, {
        rawId: 'PhoneLine_state_onHold',
        anchorTitle: 'Class PhoneLine, SM state, State onHold',
      }, '#ff0000'),
    ).toBe(`class PhoneLine {
  state {
    onHold {
      displayColor #ff0000;
    }
  }
}
`)
  })

  it('updates transition trigger, guard, action, destination, and can delete the transition', () => {
    const code = `class PhoneLine {
  state {
    communicating {
      putOnHold -> onHold;
    }

    onHold {
    }

    waitForHook {
    }
  }
}
`

    const edge = {
      rawId: 'PhoneLine_state_communicating->PhoneLine_state_onHold',
      anchorTitle: 'From communicating to onHold on putOnHold',
    }

    expect(setTransitionTriggerInCode(code, edge, 'takeOffHold')).toBe(`class PhoneLine {
  state {
    communicating {
      takeOffHold -> onHold;
    }

    onHold {
    }

    waitForHook {
    }
  }
}
`)

    expect(setTransitionGuardInCode(code, edge, '[lineAvailable]')).toBe(`class PhoneLine {
  state {
    communicating {
      putOnHold [lineAvailable] -> onHold;
    }

    onHold {
    }

    waitForHook {
    }
  }
}
`)

    expect(setTransitionActionInCode(code, edge, '{ logHold(); }')).toBe(`class PhoneLine {
  state {
    communicating {
      putOnHold / { logHold(); } -> onHold;
    }

    onHold {
    }

    waitForHook {
    }
  }
}
`)

    expect(
      setTransitionDestinationInCode(code, edge, {
        rawId: 'PhoneLine_state_waitForHook',
        anchorTitle: 'Class PhoneLine, SM state, State waitForHook',
      }),
    ).toBe(`class PhoneLine {
  state {
    communicating {
      putOnHold -> waitForHook;
    }

    onHold {
    }

    waitForHook {
    }
  }
}
`)

    expect(deleteTransitionInCode(code, edge)).toBe(`class PhoneLine {
  state {
    communicating {
    }

    onHold {
    }

    waitForHook {
    }
  }
}
`)
  })

  it('adds a transition from one state to another', () => {
    const code = `class Phone {
  screenLight {
    Off {
    }

    On {
      hangUp -> Off;
    }
  }
}
`

    const next = addTransitionInCode(
      code,
      {
        rawId: 'Phone_screenLight_Off',
        anchorTitle: 'Class Phone, SM state, State Off',
      },
      'reset',
      {
        rawId: 'Phone_screenLight_On',
        anchorTitle: 'Class Phone, SM state, State On',
      },
    )

    expect(next).toBe(`class Phone {
  screenLight {
    Off {
      reset -> On;
    }

    On {
      hangUp -> Off;
    }
  }
}
`)
  })
})
