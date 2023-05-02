import { FC, useContext, useState } from 'react';
import { UploadOutlined } from '@ant-design/icons';
import { Checkbox, Select, Button, Modal, Input, Upload, InputNumber, message, Form } from 'antd';
import type { UploadProps } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';

interface Props {
    label: string;
}

export const Knowledge: FC<Props> = ({
    label
}) => {
    const [checked, setChecked] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const onChange = (e: CheckboxChangeEvent) => {
        console.log(`checked = ${e.target.checked}`);
        setChecked(e.target.checked);
    };
    const handleChange = (value: string) => {
        console.log(`selected ${value}`);
    };
    const handleAddKnowledge = () => {
        setShowDialog(true);
    };

    const closeDialog = () => {
        setShowDialog(false);
    }
    const list = [{
        value: '123',
        name: '外贸清单'
    }]
    return <div className="flex flex-col">
        <label className="mb-2 text-left xwtext-neutral-700 dark:text-neutral-400">
            {label}
        </label>
        <div className="w-full  border-neutral-200 bg-transparent pr-2 text-neutral-900 dark:border-neutral-600 dark:text-white">
            <Checkbox onChange={onChange}>开启知识库</Checkbox>
            {
                checked ? <div>
                    <Select
                        className='w-full bg-transparent p-2'
                        onChange={handleChange}
                        options={list}
                    />
                    <Button onClick={handleAddKnowledge}>新增知识库</Button>
                </div> : null
            }

        </div>
        <KnowledgeDialog visible={showDialog} closeDialog={closeDialog} />
    </div>;
}

interface KnowledgeDialogProps {
    visible: boolean;
    closeDialog: () => void;
}

const KnowledgeDialog: FC<KnowledgeDialogProps> = ({
    visible,
    closeDialog
}) => {

    const props: UploadProps = {
        name: 'file',
        action: 'https://www.mocky.io/v2/5cc8019d300000980a055e76',
        headers: {
            authorization: 'authorization-text',
        },
        onChange(info) {
            if (info.file.status !== 'uploading') {
                console.log(info.file, info.fileList);
            }
            if (info.file.status === 'done') {
                message.success(`${info.file.name} file uploaded successfully`);
            } else if (info.file.status === 'error') {
                message.error(`${info.file.name} file upload failed.`);
            }
        },
    };

    return <Modal open={visible} footer={[
        <Button key="generate">生成知识库</Button>
    ]} onCancel={() => { closeDialog() }}
    >
        <div className='p-10'>
            <Form>
                <Form.Item label="知识名称">
                    <Input />
                </Form.Item>
                <Form.Item label="上传文件">
                    <Upload {...props}>
                        <Button icon={<UploadOutlined />}>Click to Upload</Button>
                    </Upload>
                </Form.Item>
                <Form.Item label="chunkSize">
                    <InputNumber defaultValue={1000} />
                </Form.Item>
                <Form.Item label="chunkSizeOverlap">
                    <InputNumber defaultValue={0} />
                </Form.Item>
            </Form>
        </div>

    </Modal>
}