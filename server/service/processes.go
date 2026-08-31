package service

import (
	"github.com/shirou/gopsutil/v4/process"
)


type ProcessInfo struct {

	PID int32 `json:"pid"`

	Name string `json:"name"`

	CPU float64 `json:"cpu"`

	Memory float32 `json:"memory"`

}


func ListProcesses() ([]ProcessInfo,error){

	list,err :=
		process.Processes()


	if err != nil {
		return nil,err
	}


	result :=
		make([]ProcessInfo,0)



	for _,p := range list {


		name,err :=
			p.Name()

		if err != nil {
			continue
		}



		cpu,err :=
			p.CPUPercent()

		if err != nil {
			cpu=0
		}



		mem,err :=
			p.MemoryPercent()

		if err != nil {
			mem=0
		}



		result =
			append(
				result,
				ProcessInfo{

					PID:p.Pid,

					Name:name,

					CPU:cpu,

					Memory:mem,

				},
			)


	}



	return result,nil

}
